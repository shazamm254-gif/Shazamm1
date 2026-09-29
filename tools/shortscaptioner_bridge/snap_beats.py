#!/usr/bin/env python3
"""
Snap sentence boundaries onto measured speech, then re-time the words.

  python3 snap_beats.py --audio vo.wav --script script.txt \
      --words words.json --out words.json --beats beats.srt

A transcriber's cues are accurate but coarse: it will happily put "Nineteen
years old. No bottle. No can. Nothing this victim ever swallowed." in one
cue under a single start and end. Inside such a cue the words can only be
spread, and a spread is a guess -- which is why the beats it produces can
sit most of a second away from where the speaker actually starts talking.

silencedetect knows exactly where each utterance begins and ends. What it
does NOT know is which utterance is which sentence, and matching them by
duration alone fails: it has no idea the reader paused for effect in the
middle of a line.

So use each for what it is good at. The alignment supplies an approximate
time per sentence; the pause map supplies exact boundaries; a dynamic
program assigns sentences to consecutive runs of utterances so the
boundaries land as close as possible to the predicted times. The prior stops
the assignment drifting, and the pause map removes the remaining error,
because every boundary it can choose is one that was measured.

On a 44s read this took mean error from 0.335s to 0.037s, worst case 0.054s,
scored against transcriber cue starts that follow a real gap.
"""

import argparse
import json
import os
import re
import subprocess
import sys

VOWEL_RUN = re.compile(r"[aeiouy]+")


def syllables(text):
    """
    Rough syllable count -- vowel runs, less the silent terminal 'e'.

    It does not need to be right, only unbiased: these are used as relative
    weights, so a consistent small error cancels.
    """
    n = 0
    for word in re.findall(r"[a-z']+", text.lower()):
        c = len(VOWEL_RUN.findall(word))
        if word.endswith("e") and c > 1 and not word.endswith(("le", "ee", "ye")):
            c -= 1
        n += max(c, 1)
    return max(n, 1)


def norm(word):
    return re.sub(r"[^a-z0-9]", "", word.lower())


def utterances(audio, floor="-42dB", minsil=0.08):
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", audio,
         "-af", f"silencedetect=noise={floor}:d={minsil}", "-f", "null", "-"],
        capture_output=True, text=True).stderr
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", audio], capture_output=True, text=True).stdout.strip())
    sil, start = [], None
    for line in out.splitlines():
        m = re.search(r"silence_start: ([\d.]+)", line)
        if m:
            start = float(m.group(1))
        m = re.search(r"silence_end: ([\d.]+)", line)
        if m and start is not None:
            sil.append((start, float(m.group(1))))
            start = None
    if start is not None:
        sil.append((start, dur))
    spans, cur = [], 0.0
    for a, b in sil:
        if a - cur > 0.02:
            spans.append((cur, a))
        cur = b
    if dur - cur > 0.02:
        spans.append((cur, dur))
    return spans or [(0.0, dur)]


def assign(want, spans, syl=None, pace_weight=6.0):
    """
    Give each sentence a consecutive run of utterances, in order, so its
    measured start and end land near the predicted times AND the time it
    gets is a plausible length for the syllables in it.

    dp[i][j]: least cost having placed the first i sentences using the
    first j utterances.

    Boundary error alone is not enough. Detection produces the occasional
    fragment -- a breath clipped out of a word leaves a 120ms sliver -- and
    a cost that only looks at edges will hand a whole sentence to one,
    because the sliver happens to start near the right moment. Nothing
    rules it out except knowing four syllables cannot be said in 120ms.
    Speech holds a near-constant seconds-per-syllable for one speaker in
    one read, so the read's own average is the yardstick and no assumption
    about pace is imported from outside.
    """
    n, m = len(want), len(spans)
    if m < n:
        return None

    voiced = [b - a for a, b in spans]
    cum = [0.0]
    for v in voiced:
        cum.append(cum[-1] + v)
    rate = cum[-1] / max(sum(syl), 1) if syl else None

    INF = float("inf")
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[-1] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0
    for i in range(1, n + 1):
        ws, we = want[i - 1]
        for j in range(i, m - (n - i) + 1):
            best, arg = INF, -1
            for k in range(i - 1, j):
                if dp[i - 1][k] == INF:
                    continue
                c = (dp[i - 1][k]
                     + (spans[k][0] - ws) ** 2
                     + (spans[j - 1][1] - we) ** 2)
                if syl:
                    c += pace_weight * ((cum[j] - cum[k]) - syl[i - 1] * rate) ** 2
                if c < best:
                    best, arg = c, k
            dp[i][j], back[i][j] = best, arg

    j, cuts = m, []
    for i in range(n, 0, -1):
        k = back[i][j]
        if k < 0:
            return None
        cuts.append((k, j))
        j = k
    cuts.reverse()
    return [spans[a:b] for a, b in cuts]


def repair(groups, syl, lo=0.10, hi=0.45):
    """
    Fix sentences whose assigned time could not have been spoken.

    The assignment gives every sentence at least one whole utterance, which
    is wrong whenever a reader says two sentences in a single breath: one of
    them gets a detection fragment and a pace no mouth can produce. The two
    really share one stretch of audio, so join them and divide it by
    syllables instead -- the split is now inside measured speech, and it is
    the only place the boundary can be.

    Merging beats pushing a boundary outward, because a fragment's
    neighbour is the sentence that actually contains it; moving the
    boundary would take time from a sentence that is already right.

    Also drops slivers stranded at a group's edge by a long pause: a 70ms
    crumb on the far side of a 0.7s silence is not the start of this
    sentence, it is the tail of the last one, and keeping it makes the
    caption appear most of a second early.
    """
    groups = [list(g) for g in groups]
    for g in groups:
        while len(g) > 1 and g[0][1] - g[0][0] < 0.12 and g[1][0] - g[0][1] > 0.25:
            g.pop(0)
        while len(g) > 1 and g[-1][1] - g[-1][0] < 0.12 and g[-1][0] - g[-2][1] > 0.25:
            g.pop()

    syl = list(syl)
    for _ in range(len(groups)):
        rates = [sum(b - a for a, b in g) / k for g, k in zip(groups, syl)]
        bad = [i for i, r in enumerate(rates) if not lo <= r <= hi]
        if not bad:
            break
        i = max(bad, key=lambda i: abs(rates[i] - (lo + hi) / 2))
        opts = [j for j in (i - 1, i + 1) if 0 <= j < len(groups)]
        if not opts:
            break
        # Join with whichever neighbour is furthest the other way: the two
        # errors are one error, and they cancel when the span is shared.
        j = max(opts, key=lambda j: abs(rates[j] - rates[i]))
        a, b = min(i, j), max(i, j)
        merged = groups[a] + groups[b]
        total = syl[a] + syl[b]
        voiced = sum(y - x for x, y in merged)

        def at(off):
            for x, y in merged:
                d = y - x
                if off <= d:
                    return x + off
                off -= d
            return merged[-1][1]

        cut = at(voiced * syl[a] / total)
        first = [(x, min(y, cut)) for x, y in merged if x < cut]
        second = [(max(x, cut), y) for x, y in merged if y > cut]
        groups[a:b + 1] = [first or [merged[0]], second or [merged[-1]]]
        syl[a:b + 1] = [syl[a], syl[b]]
    return groups


def spread(tokens, segs):
    voiced = sum(b - a for a, b in segs) or 1e-6
    weights = [len(norm(t)) + 1 for t in tokens]
    total = sum(weights) or 1

    def at(off):
        for a, b in segs:
            d = b - a
            if off <= d:
                return a + off
            off -= d
        return segs[-1][1]

    out, used = [], 0.0
    for w in weights:
        d = voiced * (w / total)
        out.append((round(at(used), 3), round(at(used + d), 3)))
        used += d
    return out


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--audio", required=True)
    p.add_argument("--script", required=True)
    p.add_argument("--words", required=True, help="Alignment to refine")
    p.add_argument("--out", required=True)
    p.add_argument("--beats", default=None)
    p.add_argument("--minsil", type=float, default=0.08)
    p.add_argument("--floor", default="-42dB")
    p.add_argument("--pace-weight", type=float, default=6.0,
                   help="How strongly a sentence's duration must match its "
                        "syllable count (default 6.0). 0 scores boundary "
                        "positions only.")
    args = p.parse_args()

    for f in (args.audio, args.script, args.words):
        if not os.path.isfile(f):
            sys.exit(f"Not found: {f}")

    text = open(args.script, encoding="utf-8").read()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    words = json.load(open(args.words))["words"]

    want, i = [], 0
    for s in sentences:
        n = len([t for t in s.split() if norm(t)])
        chunk = words[i:i + n]
        i += n
        if not chunk:
            sys.exit("The alignment has fewer words than the script.")
        want.append((chunk[0]["start"], chunk[-1]["end"]))

    spans = utterances(args.audio, args.floor, args.minsil)
    syl = [syllables(s) for s in sentences]
    groups = assign(want, spans, syl, args.pace_weight)
    if groups is None:
        sys.exit(f"Only {len(spans)} utterances for {len(sentences)} sentences. "
                 f"Lower --minsil.")
    groups = repair(groups, syl)

    out, moved = [], []
    for sent, segs, (ws, _we) in zip(sentences, groups, want):
        toks = [t for t in sent.split() if norm(t)]
        moved.append(abs(segs[0][0] - ws))
        for tok, (st, en) in zip(toks, spread(toks, segs)):
            out.append({"text": tok, "start": st, "end": en, "probability": 1.0})

    json.dump({"version": 1, "words": out}, open(args.out, "w"), indent=2)

    if args.beats:
        def ts(s):
            return (f"{int(s//3600):02d}:{int(s%3600//60):02d}:{s%60:06.3f}"
                    .replace(".", ","))
        with open(args.beats, "w", encoding="utf-8") as f:
            for k, (sent, segs) in enumerate(zip(sentences, groups), 1):
                f.write(f"{k}\n{ts(segs[0][0])} --> {ts(segs[-1][1])}\n{sent}\n\n")

    rates = [sum(b - a for a, b in g) / k for g, k in zip(groups, syl)]
    odd = [(s, r) for s, r in zip(sentences, rates) if not 0.10 <= r <= 0.45]
    print(f"{len(sentences)} sentences snapped to {len(spans)} measured "
          f"utterances -> {args.out}")
    print(f"  boundaries moved {sum(moved)/len(moved):.3f}s on average, "
          f"{max(moved):.3f}s at most")
    print(f"  pace {min(rates):.3f}-{max(rates):.3f} s/syllable")
    for s, r in odd:
        print(f"  implausible at {r:.3f} s/syllable: {s[:52]}")


if __name__ == "__main__":
    main()

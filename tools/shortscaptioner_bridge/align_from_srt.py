#!/usr/bin/env python3
"""
Align a script to a read using a TRANSCRIBER'S SRT as the clock.

  python3 align_from_srt.py --srt descript.srt --script script.txt \
      --audio vo.wav --out words.json --beats beats.srt

align_script.py does this same anchor-and-interpolate job against
pocketsphinx. That recogniser is fine on a bright voice and useless on a
dark one: against a read with little energy above 6 kHz it returned "a teen
titans" for "nicotine tightens", so there were no anchors to hang the script
on at all. A real transcriber gets the words right. What it will not do is
spell proper nouns and technical terms the way the script does, or agree
about punctuation, so the script remains the source of the TEXT.

What arrives from a transcriber is cue-level, not word-level: a cue may
carry eight words under one start and one end. Inside a cue, words are laid
out by length -- but a cue's boundaries are measured, so error stays bounded
by the cue rather than accumulating across the file, which is the failure
mode of spreading a whole script between two distant anchors.

Follow this with snap_beats.py, which pulls the sentence boundaries onto
measured speech and removes most of what remains.
"""

import argparse
import difflib
import json
import os
import re
import subprocess
import sys

CUE = re.compile(r"(\d+:\d+:[\d,.]+)\s*-->\s*(\d+:\d+:[\d,.]+)")


def secs(stamp):
    h, m, s = stamp.replace(",", ".").split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def read_srt(path):
    """[(start, end, text), ...] from an SRT."""
    cues, start, end, buf = [], None, None, []
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        m = CUE.search(line)
        if m:
            if start is not None and buf:
                cues.append((start, end, " ".join(buf)))
            start, end, buf = secs(m.group(1)), secs(m.group(2)), []
        elif line and not line.isdigit():
            buf.append(line)
    if start is not None and buf:
        cues.append((start, end, " ".join(buf)))
    return cues


def norm(word):
    return re.sub(r"[^a-z0-9]", "", word.lower())


def speech_spans(audio, floor="-42dB", minsil=0.10):
    """Stretches of actual speech, as (start, end) pairs."""
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


def spread(tokens, start, end, speech=None):
    """
    Lay `tokens` across [start, end], longer words holding longer.

    With a speech map the weights are spent against speaking time only and
    then mapped back to the clock. It matters most exactly where a
    transcriber is weakest: when it runs several short sentences into one
    cue, the pauses between them sit inside the span, and spreading across
    the wall clock puts words in the silence. Here a pause costs nothing, so
    every word lands inside an utterance.
    """
    if not tokens:
        return []
    if end <= start:
        end = start + 0.06 * len(tokens)

    segs = []
    if speech:
        for a, b in speech:
            lo, hi = max(a, start), min(b, end)
            if hi - lo > 0.01:
                segs.append((lo, hi))
    voiced = sum(b - a for a, b in segs)
    if not segs or voiced < 0.05:
        segs, voiced = [(start, end)], end - start

    def at(offset):
        for a, b in segs:
            d = b - a
            if offset <= d:
                return a + offset
            offset -= d
        return segs[-1][1]

    weights = [len(norm(t)) + 1 for t in tokens]
    total = sum(weights) or 1
    out, used = [], 0.0
    for w in weights:
        d = voiced * (w / total)
        out.append((round(at(used), 3), round(at(used + d), 3)))
        used += d
    return out


def cue_words(cues, speech=None):
    """Every transcribed word with a time, by spreading each cue's own span."""
    out = []
    for start, end, text in cues:
        toks = [t for t in text.split() if norm(t)]
        if not toks:
            continue
        for tok, (a, b) in zip(toks, spread(toks, start, max(end, start + 0.05),
                                            speech)):
            out.append((tok, a, b))
    return out


def align(script_tokens, heard, audio_end, speech=None):
    """Anchor every script word the transcriber also heard; interpolate the rest."""
    s_norm = [norm(t) for t in script_tokens]
    h_norm = [norm(w[0]) for w in heard]

    times = [None] * len(script_tokens)
    for i, j, n in difflib.SequenceMatcher(a=s_norm, b=h_norm,
                                           autojunk=False).get_matching_blocks():
        for k in range(n):
            times[i + k] = (heard[j + k][1], heard[j + k][2])

    anchors = [i for i, t in enumerate(times) if t is not None]
    if not anchors:
        return spread(script_tokens, 0.0, audio_end, speech), 0

    filled, first, last = list(times), anchors[0], anchors[-1]
    if first > 0:
        for idx, tv in enumerate(spread(script_tokens[:first], 0.0,
                                        times[first][0], speech)):
            filled[idx] = tv
    for a, b in zip(anchors, anchors[1:]):
        if b - a > 1:
            for off, tv in enumerate(spread(script_tokens[a + 1:b],
                                            times[a][1], times[b][0], speech)):
                filled[a + 1 + off] = tv
    if last < len(script_tokens) - 1:
        for off, tv in enumerate(spread(script_tokens[last + 1:],
                                        times[last][1], audio_end, speech)):
            filled[last + 1 + off] = tv

    # Time must not run backwards: a cue overlapping its neighbour, or a word
    # matched out of order, would otherwise hand the captioner a caption that
    # ends before it starts.
    for i in range(1, len(filled)):
        a, b = filled[i]
        _pa, pb = filled[i - 1]
        if a < pb:
            a = pb
        filled[i] = (round(a, 3), round(max(b, a + 0.04), 3))
    return filled, len(anchors)


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--srt", required=True, help="Transcriber's SRT (the clock)")
    p.add_argument("--script", required=True, help="What is actually said (the words)")
    p.add_argument("--audio", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--beats", default=None, help="Also write a per-sentence SRT")
    args = p.parse_args()

    for f in (args.srt, args.script, args.audio):
        if not os.path.isfile(f):
            sys.exit(f"Not found: {f}")

    text = open(args.script, encoding="utf-8").read()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    tokens = [t for t in text.split() if norm(t)]
    if not tokens:
        sys.exit("The script file has no words in it.")

    speech = speech_spans(args.audio)
    heard = cue_words(read_srt(args.srt), speech)
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", args.audio], capture_output=True, text=True).stdout.strip())

    times, anchored = align(tokens, heard, dur, speech)
    json.dump({"version": 1,
               "words": [{"text": t, "start": s, "end": e, "probability": 1.0}
                         for t, (s, e) in zip(tokens, times)]},
              open(args.out, "w"), indent=2)

    if args.beats:
        def ts(s):
            return (f"{int(s//3600):02d}:{int(s%3600//60):02d}:{s%60:06.3f}"
                    .replace(".", ","))
        i = 0
        with open(args.beats, "w", encoding="utf-8") as f:
            for k, sent in enumerate(sentences, 1):
                n = len([t for t in sent.split() if norm(t)])
                chunk = times[i:i + n]
                i += n
                if chunk:
                    f.write(f"{k}\n{ts(chunk[0][0])} --> {ts(chunk[-1][1])}\n{sent}\n\n")

    pct = 100.0 * anchored / len(tokens)
    print(f"{len(tokens)} script words, {len(heard)} transcribed, "
          f"{anchored} anchored to measured times ({pct:.0f}%) -> {args.out}")
    if pct < 50:
        print("  Low anchor rate for a real transcriber. Check the script "
              "matches this audio.")


if __name__ == "__main__":
    main()

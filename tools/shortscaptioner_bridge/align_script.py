#!/usr/bin/env python3
"""
Align a script you already have against a voiceover, giving true words at
real times.

  python3 align_script.py --audio vo.mp3 --script script.txt --out words.json

This is the piece that makes "here is my script and my images" work end to
end. Recognition supplies the CLOCK and the script supplies the WORDS, so
you get the accuracy of a script you wrote with the timing of the read you
actually recorded -- and nothing has to be checked afterwards.

How: the offline recogniser produces a rough word stream with timings. Those
words are matched against the script with difflib, which finds the runs that
agree. Every agreeing word is an anchor and keeps its measured time. Words
the recogniser got wrong or missed sit between two anchors and are spread
across that gap by length. Proper nouns are exactly the words recognition
fails on, so they are usually the interpolated ones -- but they are now
SPELLED correctly, and they land inside a span pinned at both ends by words
that were heard properly.

Output is a ShortsCaptioner transcript, ready for:

  python app.py --input clip.mp4 --font Anton-Regular.ttf \
                --preset hormozi --transcript words.json --output out.mp4

If you can reach HuggingFace, ShortsCaptioner's own Whisper pass is better
than the recogniser used here and this script matters less -- though feeding
it a known-correct script still beats trusting any transcription.
"""

import argparse
import difflib
import json
import os
import re
import subprocess
import sys


def recognised_words(audio):
    """Rough word stream with real timings, from the offline recogniser."""
    try:
        from pocketsphinx import Config, Decoder
        import pocketsphinx
    except ImportError:
        print("pocketsphinx is not installed:  pip install pocketsphinx")
        sys.exit(1)

    wav = "/tmp/_align16k.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-i", audio, "-ar", "16000",
                    "-ac", "1", "-y", wav], check=True)
    m = os.path.join(os.path.dirname(pocketsphinx.__file__), "model", "en-us")
    c = Config()
    c.set_string("-hmm", os.path.join(m, "en-us"))
    c.set_string("-lm", os.path.join(m, "en-us.lm.bin"))
    c.set_string("-dict", os.path.join(m, "cmudict-en-us.dict"))
    c.set_string("-logfn", os.devnull)
    d = Decoder(c)
    d.start_utt()
    with open(wav, "rb") as f:
        d.process_raw(f.read(), full_utt=True)
    d.end_utt()

    skip = {"<s>", "</s>", "<sil>", "[SPEECH]", "[NOISE]", "<unk>"}
    out = []
    for s in d.seg():
        w = s.word.split("(")[0]
        if w in skip:
            continue
        out.append((w, s.start_frame / 100.0, s.end_frame / 100.0))
    return out


def norm(word):
    """Compare on letters and digits only -- punctuation and case never match."""
    return re.sub(r"[^a-z0-9]", "", word.lower())


def align(script_tokens, heard, audio_end):
    """
    Give every script token a start and end.

    Anchors are script tokens the recogniser also heard, in the same order;
    they take its measured timing. Everything between two anchors is spread
    across the remaining gap, weighted by word length.
    """
    s_norm = [norm(t) for t in script_tokens]
    h_norm = [norm(w[0]) for w in heard]

    times = [None] * len(script_tokens)
    matcher = difflib.SequenceMatcher(a=s_norm, b=h_norm, autojunk=False)
    for i, j, n in matcher.get_matching_blocks():
        for k in range(n):
            times[i + k] = (heard[j + k][1], heard[j + k][2])

    anchors = [i for i, t in enumerate(times) if t is not None]
    if not anchors:
        # Nothing matched at all -- fall back to spreading the whole script.
        span = audio_end
        return _spread(script_tokens, 0.0, span)

    # Fill before the first anchor, between anchors, and after the last.
    filled = list(times)
    first, last = anchors[0], anchors[-1]
    if first > 0:
        for idx, tv in zip(range(0, first),
                           _spread(script_tokens[:first], 0.0, times[first][0])):
            filled[idx] = tv
    for a, b in zip(anchors, anchors[1:]):
        if b - a > 1:
            seg = _spread(script_tokens[a + 1:b], times[a][1], times[b][0])
            for off, tv in enumerate(seg):
                filled[a + 1 + off] = tv
    if last < len(script_tokens) - 1:
        seg = _spread(script_tokens[last + 1:], times[last][1], audio_end)
        for off, tv in enumerate(seg):
            filled[last + 1 + off] = tv
    return filled


def _spread(tokens, start, end):
    """Lay `tokens` across [start, end], longer words holding longer."""
    if not tokens:
        return []
    if end <= start:
        end = start + 0.05 * len(tokens)
    weights = [len(norm(t)) + 1 for t in tokens]
    total = sum(weights) or 1
    span = end - start
    out, t = [], start
    for w in weights:
        d = span * (w / total)
        out.append((round(t, 3), round(t + d, 3)))
        t += d
    return out


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--audio", required=True, help="The voiceover")
    p.add_argument("--script", required=True,
                   help="Plain text file of what is actually said")
    p.add_argument("--out", required=True, help="Output transcript .json")
    args = p.parse_args()

    for f in (args.audio, args.script):
        if not os.path.isfile(f):
            print(f"Not found: {f}")
            sys.exit(1)

    text = open(args.script, encoding="utf-8").read()
    tokens = [t for t in text.split() if norm(t)]
    if not tokens:
        print("The script file has no words in it.")
        sys.exit(1)

    heard = recognised_words(args.audio)
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", args.audio],
        capture_output=True, text=True, check=True).stdout.strip())

    times = align(tokens, heard, dur)
    words = [{"text": tok, "start": st, "end": en, "probability": 1.0}
             for tok, (st, en) in zip(tokens, times)]
    json.dump({"version": 1, "words": words}, open(args.out, "w"), indent=2)

    anchored = sum(1 for t, w in zip(times, tokens)
                   if any(norm(w) == norm(h[0]) and abs(t[0] - h[1]) < 1e-6
                          for h in heard))
    pct = 100.0 * anchored / len(tokens)
    print(f"{len(tokens)} script words, {len(heard)} recognised, "
          f"{anchored} anchored to measured times ({pct:.0f}%) -> {args.out}")
    if pct < 25:
        print("  Low anchor rate. Check the script really matches this audio.")


if __name__ == "__main__":
    main()

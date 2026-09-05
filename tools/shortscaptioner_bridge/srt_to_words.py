#!/usr/bin/env python3
"""
Build a ShortsCaptioner word-level transcript from a corrected SRT.

ShortsCaptioner highlights the word being spoken, so it needs per-word times.
An SRT only carries phrase times. This spreads each caption's words across its
own span, weighting by character count so long words hold longer than short
ones -- which is closer to speech than an even split.

The point is accuracy of TEXT. Phrase boundaries stay exactly where the SRT
puts them (those were measured off the audio), so cards appear and leave on
time; only the highlight sweep inside a phrase is approximate.

Prefer real word timings when you can get them: on a machine that can reach
HuggingFace, ShortsCaptioner's own Whisper pass gives both accurate text and
true per-word times, and this script is unnecessary.
"""
import json, re, sys

def parse_srt(path):
    out = []
    raw = open(path, encoding="utf-8-sig").read().replace("\r\n", "\n")
    for chunk in raw.strip().split("\n\n"):
        lines = [l for l in chunk.split("\n") if l.strip()]
        tline = next((l for l in lines if "-->" in l), None)
        if not tline:
            continue
        m = re.findall(r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})", tline)
        if len(m) != 2:
            continue
        def s(g):
            return int(g[0])*3600 + int(g[1])*60 + int(g[2]) + int(g[3])/1000
        text = " ".join(lines[lines.index(tline)+1:]).split("  #")[0].strip()
        if text:
            out.append((s(m[0]), s(m[1]), text))
    return out

def words_from_srt(entries):
    words = []
    for start, end, text in entries:
        toks = text.replace("\n", " ").split()
        if not toks:
            continue
        weights = [len(t) + 1 for t in toks]          # +1 so 1-char words aren't starved
        total = sum(weights)
        span = max(end - start, 0.05)
        t = start
        for tok, wgt in zip(toks, weights):
            dur = span * (wgt / total)
            words.append({"text": tok, "start": round(t, 3),
                          "end": round(t + dur, 3), "probability": 1.0})
            t += dur
    return words

if __name__ == "__main__":
    srt, out = sys.argv[1], sys.argv[2]
    w = words_from_srt(parse_srt(srt))
    json.dump({"version": 1, "words": w}, open(out, "w"), indent=2)
    print(f"{len(w)} words from {len(parse_srt(srt))} captions -> {out}")

#!/usr/bin/env python3
"""
Word timings with no transcriber at all, off the read's own splices.

  python3 align_from_splices.py --audio vo.wav --script script.txt \
      --splices vo.splices.json --out words.json --beats beats.srt

The other two aligners here need something that already listened to the
audio: align_from_srt.py wants a transcriber's cues, align_script.py wants
pocketsphinx. On a machine with neither -- which is this one, since the
proxy blocks HuggingFace and pocketsphinx is not installed -- there is
still enough information to do the job, because nothing about the words is
actually unknown. The script IS the transcript. The only question is the
clock.

And the read answers most of that question itself. A generated voiceover
is rendered a paragraph at a time and spliced together, which leaves a run
of exact digital zero at every paragraph break. fill_dead_air.py records
those positions before it fills them in, and they are measurements, not
guesses: thirteen paragraphs means twelve known boundaries, each accurate
to the sample.

That is the whole trick. Pinning the paragraphs first turns one 225-word
alignment into thirteen small ones, each over a span whose start and end
are known, and -- the part that matters -- puts a hard wall between them.
An error inside a paragraph stays inside that paragraph.

Why not just use the longest pauses in the finished file: tried it, and it
took two of the reader's dramatic pauses for paragraph breaks and missed
two real ones, which threw whole paragraphs several seconds onto the wrong
span. A pause for effect is longer than some real breaks. Duration cannot
tell them apart; digital silence can.

Inside a paragraph, sentences are assigned to measured runs of speech by a
small dynamic program, and words are spread across their sentence by
syllable count, because "masterpiece" takes longer to say than "it". The
assignment is the same idea as snap_beats.py, but bounded: over a whole
read that search has too many ways to go wrong, and on this episode it
drifted six seconds by the middle.
"""

import argparse
import json
import re
import subprocess

import numpy as np

VOWELS = 'aeiouy'


def syllables(w):
    """Vowel groups, with a silent terminal 'e' discounted.

    Crude, and it does not need to be better. It is only ever used to
    divide a span whose length is already known between the words in it,
    so a word being one syllable out moves a boundary by tens of
    milliseconds."""
    w = re.sub(r'[^a-z]', '', w.lower())
    if not w:
        return 1
    n, prev = 0, False
    for c in w:
        v = c in VOWELS
        if v and not prev:
            n += 1
        prev = v
    if w.endswith('e') and n > 1:
        n -= 1
    return max(1, n)


def envelope(audio, sr=48000, win=0.02, hop=0.005):
    raw = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', audio,
         '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'],
        capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    w, h = int(win * sr), int(hop * sr)
    n = (len(x) - w) // h
    e = np.sqrt(np.array([(x[i * h:i * h + w] ** 2).mean() for i in range(n)]))
    return 20 * np.log10(e + 1e-12), h / sr, len(x) / sr


def speech_runs(db, hop, min_pause=0.12, below=35.0):
    """Stretches of actual talking, and the gaps between them.

    Threshold is relative to the read's own speech level rather than a
    fixed dBFS, so it does not need retuning per read -- a fixed floor was
    what disagreed with the splice map the first time this was tried."""
    thr = np.percentile(db, 90) - below
    act = db > thr
    d = np.diff(np.concatenate(([0], act.astype(np.int8), [0])))
    s, e = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
    runs = [[a * hop, b * hop] for a, b in zip(s, e)]
    # Join runs separated by less than a breath; those splits are inside
    # words, not between them.
    out = [runs[0]]
    for r in runs[1:]:
        if r[0] - out[-1][1] < min_pause:
            out[-1][1] = r[1]
        else:
            out.append(r)
    return [tuple(r) for r in out]


def split_sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip())
            if s.strip()]


def assign(sents, runs):
    """Which consecutive runs belong to which sentence, by least error.

    Every sentence gets at least one run and every run is used, so the
    only freedom is where the joins go. Cost is how far each sentence's
    share of the speech is from what its syllable count predicts."""
    ns, nr = len(sents), len(runs)
    if ns > nr:                       # more sentences than pauses to put
        return None                   # them in: fall back to a flat spread
    syl = [sum(syllables(w) for w in s.split()) for s in sents]
    total_syl = sum(syl)
    dur = [b - a for a, b in runs]
    total_dur = sum(dur)
    cum = np.concatenate(([0.0], np.cumsum(dur)))
    INF = float('inf')
    best = np.full((ns + 1, nr + 1), INF)
    back = np.zeros((ns + 1, nr + 1), int)
    best[0][0] = 0.0
    for i in range(1, ns + 1):
        want = total_dur * syl[i - 1] / total_syl
        for j in range(i, nr - (ns - i) + 1):
            for k in range(i - 1, j):
                if best[i - 1][k] == INF:
                    continue
                got = cum[j] - cum[k]
                c = best[i - 1][k] + (got - want) ** 2
                if c < best[i][j]:
                    best[i][j], back[i][j] = c, k
    if best[ns][nr] == INF:
        return None
    cuts, j = [], nr
    for i in range(ns, 0, -1):
        k = back[i][j]
        cuts.append((k, j))
        j = k
    return list(reversed(cuts))


def lay_words(words, spans):
    """Spread words across one sentence's speech, skipping its pauses."""
    syl = [syllables(w) for w in words]
    talk = sum(b - a for a, b in spans)
    rate = talk / max(1, sum(syl))
    out, si, t = [], 0, spans[0][0]
    for w, s in zip(words, syl):
        need = rate * s
        while si < len(spans) - 1 and t + need > spans[si][1] + 1e-9:
            left = max(0.0, spans[si][1] - t)
            need -= left
            si += 1
            t = spans[si][0]
        out.append({'text': w, 'start': round(t, 3),
                    'end': round(min(t + need * 0.92, spans[si][1]), 3),
                    'probability': 0.0})
        t += need
    return out


def srt_time(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h:02d}:{m:02d}:{s:06.3f}'.replace('.', ',')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--audio', required=True)
    p.add_argument('--script', required=True)
    p.add_argument('--splices', required=True,
                   help='the .splices.json fill_dead_air.py wrote')
    p.add_argument('--out', required=True)
    p.add_argument('--beats', default=None, help='also write a sentence SRT')
    p.add_argument('--min-pause', type=float, default=0.12)
    a = p.parse_args()

    paras = [q.strip() for q in open(a.script).read().split('\n\n') if q.strip()]
    db, hop, dur = envelope(a.audio)
    runs = speech_runs(db, hop, a.min_pause)
    rec = [s['start'] for s in json.load(open(a.splices))['splices']]

    need = len(paras) - 1
    if len(rec) < need:
        raise SystemExit(f'{len(rec)} splices for {need} paragraph breaks -- '
                         f'the read was not spliced per paragraph')
    cuts = rec[:need]
    print(f'{len(paras)} paragraphs, {len(runs)} speech runs, '
          f'{len(rec)} splices')

    # Split the runs into paragraphs at the measured splices.
    buckets, k = [[] for _ in paras], 0
    for r in runs:
        while k < need and r[0] >= cuts[k] - 0.05:
            k += 1
        buckets[k].append(r)

    rows, flat = [], 0
    for k, (para, rs) in enumerate(zip(paras, buckets)):
        sents = split_sentences(para)
        if not rs:
            raise SystemExit(f'paragraph {k + 1} has no speech in it')
        plan = assign(sents, rs)
        if plan is None:
            flat += 1
            plan = [(0, len(rs))] * 1
            rows += lay_words(para.split(), rs)
            note = f'{len(sents)} sentence(s) over {len(rs)} run(s), spread'
        else:
            for s, (i, j) in zip(sents, plan):
                rows += lay_words(s.split(), rs[i:j])
            note = f'{len(sents)} sentence(s) -> {len(rs)} run(s)'
        print(f'  p{k + 1:<2} {rs[0][0]:6.2f}-{rs[-1][1]:6.2f}s  {note}')

    json.dump({'version': 'splices', 'words': rows}, open(a.out, 'w'))
    print(f'{len(rows)} words -> {a.out}'
          + (f'   ({flat} paragraph(s) had more sentences than pauses)'
             if flat else ''))

    if a.beats:
        lines, i, n = [], 0, 0
        for para in paras:
            for s in split_sentences(para):
                m = len(s.split())
                n += 1
                lines.append(f'{n}\n{srt_time(rows[i]["start"])} --> '
                             f'{srt_time(rows[i + m - 1]["end"])}\n{s}\n')
                i += m
        open(a.beats, 'w').write('\n'.join(lines))
        print(f'{n} sentence(s) -> {a.beats}')


if __name__ == '__main__':
    main()

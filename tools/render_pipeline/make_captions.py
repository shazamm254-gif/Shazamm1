#!/usr/bin/env python3
"""
Turn a voiceover into a draft SRT, with the cuts already on the breaths.

  python3 make_captions.py --audio vo.mp3 --out beats.srt

WHAT THIS IS GOOD AT, AND WHAT IT IS NOT
----------------------------------------
The **timings are the point**. They come from measuring where the speaker
actually pauses, and they are reliable -- good enough to cut shots on.

The **words are a draft**. Offline recognition mangles proper nouns in
particular: real runs of this have produced "them not she'll at best heroes"
for "damnatio ad bestias" and "idea graham" for "Ideogram". Every line is
written into the SRT anyway, because fixing a wrong word is far quicker than
typing the line from scratch against a stopwatch.

So the workflow is: run this, open the SRT, fix the wording, render. You are
correcting text, never timing.

Lines the recogniser was least sure of are marked with a trailing "  # ?" so
you know where to look first. Delete the marker when you have checked it --
`make_video.py` strips anything after "  #" before burning, so a marker left
in by accident will not end up on screen.

  --min-pause   how long a silence has to be to start a new caption (0.20s)
  --max-words   split a caption that runs longer than this many words
  --shift       nudge every timing by N seconds if the read sits early or late
"""

import argparse
import os
import subprocess
import sys
import tempfile

SAMPLE_RATE = 16000


def to_wav(src, dst):
    """Recognition needs 16 kHz mono; everything else is converted to it."""
    subprocess.run(
        ["ffmpeg", "-v", "error", "-i", src, "-ar", str(SAMPLE_RATE),
         "-ac", "1", "-y", dst],
        check=True,
    )
    return dst


def recognise(wav_path):
    """[(word, start, end, confidence), ...] from the offline recogniser."""
    try:
        from pocketsphinx import Config, Decoder
    except ImportError:
        print("pocketsphinx is not installed. Install it with:\n"
              "    pip install pocketsphinx\n"
              "It is a self-contained offline recogniser -- no model download, "
              "no API key, no network.")
        sys.exit(1)

    import pocketsphinx
    model = os.path.join(os.path.dirname(pocketsphinx.__file__), "model", "en-us")
    cfg = Config()
    cfg.set_string("-hmm", os.path.join(model, "en-us"))
    cfg.set_string("-lm", os.path.join(model, "en-us.lm.bin"))
    cfg.set_string("-dict", os.path.join(model, "cmudict-en-us.dict"))
    cfg.set_string("-logfn", os.devnull)

    dec = Decoder(cfg)
    dec.start_utt()
    with open(wav_path, "rb") as f:
        dec.process_raw(f.read(), full_utt=True)
    dec.end_utt()

    skip = {"<s>", "</s>", "<sil>", "[SPEECH]", "[NOISE]", "<unk>"}
    out = []
    for seg in dec.seg():
        word = seg.word.split("(")[0]          # strip pronunciation variants
        if word in skip:
            continue
        out.append((word, seg.start_frame / 100.0, seg.end_frame / 100.0, seg.prob))
    return out


def _split_at_widest_gap(beat, max_words):
    """
    Break an over-long run at its biggest internal breath, recursively.

    Splitting on the word count instead puts the cut wherever the counter
    happens to land, which strands whatever follows -- an early version of
    this left the single word "die" alone on screen for 0.45s. The widest
    gap is the nearest thing to a phrase boundary the audio actually offers.
    """
    if len(beat) <= max_words:
        return [beat]
    gaps = [(beat[i + 1][1] - beat[i][2], i) for i in range(len(beat) - 1)]
    # Only consider splits that leave something on both sides.
    inner = [(g, i) for g, i in gaps if 0 < i < len(beat) - 1] or gaps
    _, at = max(inner)
    left, right = beat[:at + 1], beat[at + 1:]
    return _split_at_widest_gap(left, max_words) + _split_at_widest_gap(right, max_words)


def group_into_beats(words, min_pause, max_words, min_duration=0.55):
    """
    Split the word stream into captions at the speaker's own pauses.

    Cutting on a pause is what makes captions and shots feel deliberate -- a
    cut mid-phrase reads as a mistake even when the timing is technically
    correct.

    Three passes: split on real pauses, break anything still too long at its
    widest internal gap, then absorb any leftover scrap too short to read
    back into whichever neighbour it was closer to.
    """
    beats, cur, prev_end = [], [], None
    for w in words:
        if cur and prev_end is not None and w[1] - prev_end >= min_pause:
            beats.append(cur)
            cur = []
        cur.append(w)
        prev_end = w[2]
    if cur:
        beats.append(cur)

    split = []
    for b in beats:
        split.extend(_split_at_widest_gap(b, max_words))

    # Absorb scraps. A caption under min_duration cannot be read at all, so
    # it belongs to a neighbour rather than on screen by itself.
    merged = []
    for b in split:
        dur = b[-1][2] - b[0][1]
        if merged and dur < min_duration:
            merged[-1] = merged[-1] + b
        else:
            merged.append(b)
    return merged


def srt_time(t):
    t = max(t, 0.0)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}".replace(".", ",")


def write_srt(beats, path, shift=0.0, flag_below=-1000.0):
    with open(path, "w", encoding="utf-8") as f:
        for i, beat in enumerate(beats, 1):
            start = beat[0][1] + shift
            end = beat[-1][2] + shift
            text = " ".join(w[0] for w in beat)
            worst = min(w[3] for w in beat)
            marker = "  # ?" if worst < flag_below else ""
            f.write(f"{i}\n{srt_time(start)} --> {srt_time(end)}\n{text}{marker}\n\n")
    return path


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--audio", required=True, help="Voiceover: mp3, wav, m4a, ...")
    p.add_argument("--out", required=True, help="Output .srt path")
    p.add_argument("--min-pause", type=float, default=0.20,
                   help="Silence long enough to start a new caption, in seconds "
                        "(default 0.20). Raise it for fewer, longer captions.")
    p.add_argument("--max-words", type=int, default=9,
                   help="Split a caption that runs past this many words (default 9)")
    p.add_argument("--shift", type=float, default=0.0,
                   help="Nudge every timing by this many seconds")
    p.add_argument("--flag-below", type=float, default=-4000.0,
                   help="Mark captions whose worst word scores below this with "
                        "'# ?' so you know where to check first")
    args = p.parse_args()

    if not os.path.isfile(args.audio):
        print(f"Audio not found: {args.audio}")
        sys.exit(1)

    build = tempfile.mkdtemp(prefix="makecaptions_")
    wav = to_wav(args.audio, os.path.join(build, "vo16k.wav"))

    words = recognise(wav)
    if not words:
        print("Nothing recognised. Check the file actually contains speech.")
        sys.exit(1)

    beats = group_into_beats(words, args.min_pause, args.max_words)
    write_srt(beats, args.out, shift=args.shift, flag_below=args.flag_below)

    flagged = sum(1 for b in beats
                  if min(w[3] for w in b) < args.flag_below)
    span = words[-1][2] - words[0][1]
    print(f"{len(words)} words, {len(beats)} captions over {span:.1f}s -> {args.out}")
    if flagged:
        print(f"  {flagged} caption(s) marked '# ?' -- check those first")
    print("\nThe TIMINGS are reliable; the WORDS are a draft. Open the SRT, fix the\n"
          "wording, then render. Proper nouns are what this gets wrong most.")


if __name__ == "__main__":
    main()

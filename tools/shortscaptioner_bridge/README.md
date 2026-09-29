# Feeding ShortsCaptioner without Whisper

ShortsCaptioner (`claude/shortscaptioner-viral-captions-2x7vwc`) transcribes
with faster-whisper, which downloads its weights from HuggingFace on first
run. **On your own machine that is the right way to use it** — Whisper gives
both accurate text and true per-word timings, and neither script here is
needed.

These exist because the sandbox this was built in cannot reach HuggingFace
(the proxy returns 403), and because a mangled word burned at 103px is far
more damaging than a missing one. ShortsCaptioner's three stages are
independent by design and `app.py --transcript FILE` **loads** that file if it
already exists, so both scripts simply write it.

| Script | Use when |
|---|---|
| `align_from_srt.py` + `snap_beats.py` | **The pair to reach for when you have a real transcript.** Any transcriber's SRT supplies the clock, your script supplies the words. See below. |
| `align_script.py` | You have the script and the audio but no transcriber. Pocketsphinx supplies the clock. Fine on a bright voice — 72 of 100 words anchored on the Rome read — but see the warning below before trusting it. |
| `sphinx_to_transcript.py` | You need *a* transcript and Whisper is unavailable. Offline, no download. Timings are real; **the words are unreliable** — it rendered "damnatio ad bestias" as "AT BEST HEROES" on screen. |
| `srt_to_words.py` | You already have correct wording in an SRT and don't need the snap step. Spreads each caption's words across its own span, weighted by length. |

## Pocketsphinx fails completely on some voices

It is an acoustic model from another era and it leans on consonant energy
above 6 kHz. Against a dark voice (rolloff 6.2 kHz, where the previous
narrator measured 8.3) it returned **"a teen titans"** for "nicotine
tightens" and anchored nothing usable. Boosting presence and normalising
first did not help — the information is not there.

Symptom to watch for: an anchor rate under ~25%, or a transcript that reads
as noise. Switch to `align_from_srt.py` rather than trying to rescue it.

## The two-step, when you have a transcriber

Any source of an SRT works — Whisper locally, or a transcription service.

```bash
# 1. anchor the script to the transcriber's clock
python3 align_from_srt.py --srt transcript.srt --script script.txt \
        --audio vo.wav --out words.json

# 2. pull sentence boundaries onto measured speech
python3 snap_beats.py --audio vo.wav --script script.txt \
        --words words.json --out words.json --beats beats.srt
```

Step 2 is not optional polish. Transcriber cues are accurate but **coarse**:
four short sentences can arrive under one start and one end, and spreading
words inside that span is a guess. On a 44s read, snapping took mean beat
error from **0.335s to 0.037s** (worst case 0.054s), scored against cue
starts that follow a real gap.

Two failure modes it exists to fix, both seen in production:

- A **120ms detection sliver** handed an entire sentence — "It's
  hygroscopic" at 0.023 s/syllable, which no mouth can produce. The reader
  had said two sentences in one breath, so they share one stretch of audio
  and get split by syllable count instead.
- A **70ms crumb** stranded across a 0.7s pause pulled a caption 0.8s early.

`snap_beats.py` prints the pace it ended up with in seconds per syllable and
names any sentence outside 0.10–0.45. Natural speech sits near 0.15–0.25, so
anything it flags is genuinely misassigned — check `beats.srt` before
rendering.

**Scoring a transcriber's SRT.** Cue starts are only ground truth when they
follow a real gap. Where two cues share a timestamp exactly, the transcriber
split continuous speech for line-length reasons and that boundary means
nothing — exclude those before measuring anything against it.

```bash
# corrected SRT -> word transcript -> captioned video
python3 tools/shortscaptioner_bridge/srt_to_words.py beats.srt words.json
python3 app.py --input clip.mp4 --font Anton-Regular.ttf \
               --transcript words.json --output captioned.mp4
```

Phrase boundaries come from the SRT, which was measured off the audio, so
cards still appear and leave on the beat.

**Fonts.** None ships with ShortsCaptioner. Anton works and is fetchable:

```bash
curl -sSfL -o fonts/Anton-Regular.ttf \
  https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf
```

The `github.com/.../raw/` form is blocked by the proxy; `raw.githubusercontent.com`
is not.

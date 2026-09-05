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
| `sphinx_to_transcript.py` | You need *a* transcript and Whisper is unavailable. Offline, no download. Timings are real; **the words are unreliable** — it rendered "damnatio ad bestias" as "AT BEST HEROES" on screen. |
| `srt_to_words.py` | You already have correct wording in an SRT. Spreads each caption's words across its own span, weighted by length. Text is exactly right; only the highlight sweep *inside* a phrase is approximate. |

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

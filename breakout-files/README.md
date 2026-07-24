# Breakout Files

A v2 YouTube Shorts pipeline for a death-row / prisoner "Case File" series —
deadpan documentary narration, factual public-record cases only. One command
in, one finished vertical .mp4 out.

Built deliberately small: **one `run.py`, one `config.yaml`.** No 35-module
framework — just five stages in one script.

```
config.yaml   — every key, voice ID, prompt, and knob. Nothing hardcoded.
run.py        — SCRIPT -> VOICEOVER -> IMAGES -> ASSEMBLY -> METADATA
requirements.txt
.env.example
sample/dry_run_sample.json   — bundled fixture for offline testing
assets/                      — optional music.mp3 + stock/ fallback frames
```

## What each stage does

1. **SCRIPT** — Claude API turns a case name into a 45-55s script: hook in
   the first 2 seconds, crime, sentence, final days, last words/last meal,
   then a flat "File remains open" outro. Output is JSON: 6-8 scenes, each
   with narration text and an image prompt.
2. **VOICEOVER** — ElevenLabs (voice `nPczCjzI2devNBz1zQrb`, Brian), one mp3
   per scene, using the `with-timestamps` endpoint so scene durations come
   from real character-level alignment, not guesses.
3. **IMAGES** — FLUX.1-schnell on a Hugging Face ZeroGPU Space via
   `gradio_client`, styled photorealistic noir (locked in config), cropped by
   ffmpeg to 768x1344 (9:16). Fails a scene 3x -> falls back to a stock frame
   from `assets/stock/` rather than stopping the run.
4. **ASSEMBLY** — ffmpeg only, no moviepy. Ken Burns zoom/pan per scene,
   scene durations from the real voiceover timestamps, 0.3s crossfades
   between scenes, optional `assets/music.mp3` auto-ducked under the
   narration. Output: 1080x1920 mp4.
5. **METADATA** — title, description, 3 hashtags written to `metadata.txt`
   next to the mp4.

## Install (Termux / Android ARM, Python 3.14)

`hf-xet`'s Rust build fails on Termux ARM, so `huggingface_hub` has to go in
with `--no-deps` and its runtime deps added by hand, in this order:

```bash
pkg install ffmpeg python
pip install --no-deps huggingface_hub==0.34.4
pip install filelock fsspec packaging pyyaml tqdm typing-extensions pillow
pip install anthropic gradio_client
```

Then:

```bash
cp .env.example .env
# edit .env with your real keys
source .env
```

## Run it

```bash
# 0. Prove the assembly pipeline works with zero API calls first:
python run.py --dry-run

# 1. Then the real thing:
python run.py "Case Name (State, Year)"
```

Output lands in `output/<slugified-case-name>/final.mp4` and
`metadata.txt` next to it.

## Editing the format

Everything that shapes the video lives in `config.yaml`:
`anthropic.system_prompt` (script structure/tone), `elevenlabs.voice_id`,
`image.style_prompt` / `negative_prompt`, `video.kenburns_*`,
`video.music_duck_db`, `video.crossfade_sec`. Change a value, no code edits
needed.

## Guardrails

The system prompt is scoped to public-record facts only: no invented
dialogue, no gore, no glorification, and it omits any detail (e.g. last
words) that isn't reliably documented rather than inventing one. Image
prompts are instructed to stay purely scenic/atmospheric — no depiction of a
real person's face or likeness, no on-image text, no graphic violence.

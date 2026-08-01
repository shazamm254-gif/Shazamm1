# Wild Secrets Studio

A free, open-source desktop app that turns one wildlife topic into a complete
faceless AI YouTube Shorts production package: title, hooks, a timestamped
45–60s script, scene breakdown, AI image prompts, image-to-video prompts,
a thumbnail package, SEO, timed captions, and an optional free voiceover —
all exportable as one folder you can start producing from immediately.

No paid API is required. Every feature has a free default.

## Install

```bash
cd wildlife-shorts-studio
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Open the URL it prints (defaults to `http://127.0.0.1:7860`).

## What works out of the box (zero setup)

- **Script, scene, prompt, SEO, and caption generation** — offline,
  template-based, deterministic. No install, no API key, no internet
  required for these.
- **Voiceover via Edge TTS** — free, no API key, natural-sounding neural
  voices, needs only an internet connection (`pip install edge-tts`,
  already in `requirements.txt`).
- **SQLite project storage** — every generated Short is saved locally in
  `wildlife_shorts.db` and listed on the Dashboard.
- **Full folder export**, zipped for one-click download.

## Optional upgrades (all free)

| Feature | What it needs | Why bother |
|---|---|---|
| **Ollama** (richer, LLM-written scripts/prompts) | Install [ollama.com](https://ollama.com), run `ollama pull llama3.1` then `ollama serve` | The offline generator is template-based and will repeat phrasing across a batch of Shorts; a local LLM writes original, specific copy for every scene. Free, runs entirely on your machine. |
| **Piper TTS** (offline voiceover) | Install the `piper` binary + a `.onnx` voice model from [rhasspy/piper](https://github.com/rhasspy/piper); set `PIPER_BINARY` / `PIPER_MODEL_PATH` | Fully offline voiceover, no internet needed at synthesis time. |
| **Coqui TTS / XTTS** (offline, higher quality, voice cloning) | `pip install TTS` (heavy, ~2GB+ with models) | Best offline voice quality; XTTS also supports cloning a reference voice. |
| **ffmpeg** (WAV→MP3 conversion) | Install via your OS package manager | Piper/Coqui output WAV; without ffmpeg you'll just keep the WAV file, which works fine everywhere. |
| **OpenRouter** (hosted LLM, optional, *not free*) | Set `OPENROUTER_API_KEY` | Only if you don't want to run a local model. Strictly optional — never required. |

The app detects what's installed at runtime (Dashboard → Voiceover tab shows
✅/⚠️ per engine) and always falls back to the free/offline path if something
optional isn't set up.

## Using it

1. **Create Short tab** — type a wildlife topic (or click one of the 10
   templates), optionally turn on Ollama/OpenRouter under "LLM backend", and
   click **Generate Full Package**. Every module (script, scenes, image
   prompts, video prompts, thumbnail, SEO, captions) fills in and the project
   auto-saves.
2. **Voiceover tab** — pick a TTS engine and voice, click **Generate
   Voiceover**. It narrates the exact script from the Short you just created.
3. **Export tab** — click **Export Project** to write the full folder
   structure to `projects/` and download it as a zip.
4. **Dashboard tab** — see all saved Shorts, reload any of them by ID back
   into the Create Short tab, and check aggregate stats.

## Architecture

```
wildlife-shorts-studio/
  app.py                    Gradio UI — Dashboard, Create Short, Voiceover, Export tabs
  core/
    config.py                Paths, defaults, the channel's shared voice/style constants
    models.py                Typed dataclasses shared by every module (Project, Scene, ...)
    database.py               SQLite persistence
  generators/
    llm_client.py             Unified offline / Ollama / OpenRouter client
    script_generator.py       Title, hooks, timestamped script, retention analysis, viral score
    scene_generator.py        Splits the script into scenes with cinematic direction
    prompt_generator.py       AI image prompts, image-to-video prompts, thumbnail package
    seo_generator.py          Titles, description, hashtags, keywords
    caption_generator.py      Timed caption cues + SRT/TXT/ASS export
  voiceover/
    tts_engine.py              Edge TTS / Piper / Coqui / XTTS behind one interface
  export/
    exporter.py                Writes + zips the full production folder
  projects/                   Generated Shorts land here (gitignored)
```

Every generator follows the same pattern: try the configured LLM backend
first (if the user turned one on and it's reachable), and fall back to a
deterministic offline generator otherwise. No generator ever hard-fails for
lack of an API key or a running model server.

## Honest limitations

- **Offline generation is template-based, not creative writing.** Without an
  LLM backend, the script/scene/prompt text is built from sentence templates
  filled in with your topic — it's reliable and always works, but it will
  read as repetitive across a large batch and won't capture facts it doesn't
  already have a template for. Turning on Ollama (free, local) is a large
  quality jump for exactly this reason — use it if you're producing more
  than a couple of Shorts.
- **This app does not generate actual images or video.** It generates the
  *prompts* for those (per your spec) — paste `Images/scene_XX.txt` into
  Midjourney/Flux/Leonardo and `Video Prompts/scene_XX.txt` into
  Runway/Kling/Luma yourself, then drop the results into `Assets/`.
- **Edge TTS needs internet** (it calls a free Microsoft endpoint under the
  hood); Piper and Coqui/XTTS are the fully-offline options if that's a
  requirement for you.
- **Always fact-check generated wildlife claims** before publishing,
  regardless of backend — see `docs/WILDLIFE_AI_SYSTEM_PROMPT.md` in the
  parent repo for the channel's fact-checking checklist.

## Configuration (all optional, via environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `WSS_LLM_BACKEND` | `offline` | Default backend on startup: `offline`, `ollama`, or `openrouter` |
| `OLLAMA_HOST` | `http://localhost:11434` | Where to reach a local Ollama server |
| `OLLAMA_MODEL` | `llama3.1` | Which local model to use |
| `OPENROUTER_API_KEY` | *(unset)* | Enables the optional hosted backend |
| `OPENROUTER_MODEL` | `meta-llama/llama-3.1-8b-instruct:free` | OpenRouter model ID |
| `PIPER_BINARY` | `piper` | Path to the Piper binary, if not on PATH |
| `PIPER_MODEL_PATH` | *(unset)* | Path to a downloaded `.onnx` Piper voice model |
| `COQUI_MODEL_NAME` | `tts_models/en/ljspeech/tacotron2-DDC` | Coqui/XTTS model to load |

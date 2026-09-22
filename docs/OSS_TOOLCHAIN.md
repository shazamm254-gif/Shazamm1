# Open-Source Toolchain — What to Bolt On to Actually Earn

A survey of GitHub, scoped to one question: **what can this repo use to turn
scripts into money?** Every repo below was checked on GitHub on **2026-09-22** —
star counts, last-push dates and licences are from that day, not from memory.

## The gap this repo has

This repo is strong at the *front* of the pipeline and empty at the *back*:

```
niche pick → script → voiceover → visuals → edit → captions → upload → monetise
✅ done      ✅ done   ❌ none     ❌ none   ❌ none  ❌ none    ❌ none   ⚠️ one channel
  (tools/)   (docs/)   ───────────── the whole gap ─────────────      (AdSense only)
```

`tools/` generates niches, ideas and scripts. `docs/` holds ready-to-record
voiceovers and image prompts. Then you stop and do everything by hand on a phone.
That manual middle is the reason output is capped, and output is the only input
to revenue. Everything below either closes that gap or opens a second revenue
line that doesn't depend on the YouTube Partner Programme.

---

## Tier 1 — Close the render gap (pick exactly one)

These take a topic or script and emit a finished vertical video. Pick one, don't
evaluate all four.

| Repo | Stars | Licence | Last push | Read |
|---|---|---|---|---|
| **[harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo)** | 125k | **MIT** | 2026-09-21 | Topic/keyword → HD short. Script, TTS, stock footage, subtitles, ffmpeg. Web UI + API. The safe default. |
| **[rushindrasinha/youtube-shorts-pipeline](https://github.com/rushindrasinha/youtube-shorts-pipeline)** | 2.3k | **MIT** | 2026-06-09 | news → script → visuals → VO → captions → **upload**. The only one here that closes the loop all the way to publishing. Small, readable Python. |
| [ATH-MaaS/Pixelle-Video](https://github.com/ATH-MaaS/Pixelle-Video) | 28k | **Apache-2.0** | 2026-06-14 | ComfyUI-backed short-video engine. Best ceiling on visual quality, heaviest setup (needs a GPU). |
| [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) | 61k | ⚠️ **AGPL-3.0** | 2026-09-06 | Agentic production system, 12 pipelines, driven from Claude Code. Most capable — but see the licence warning below. |

**Recommendation: `youtube-shorts-pipeline` first, `MoneyPrinterTurbo` as the
fallback.** The former is MIT, already ends in an upload, and is small enough to
read in an afternoon — which matters, because you're going to replace its script
stage with `tools/viral_generator.py`. MoneyPrinterTurbo is far more popular and
better maintained, but stops at the rendered file.

### ⚠️ The AGPL trap

**OpenMontage and ArcReel are AGPL-3.0.** Using them to render videos you upload
is completely fine — the videos are your output, not derived works. But if you
ever wrap either one in the hosted tool described in Tier 4, AGPL obliges you to
publish your entire server source to your users. That kills the SaaS option.
Keep AGPL code on the *production* side of the wall and out of anything you sell.

---

## Tier 2 — Components, if you'd rather assemble than adopt

### Voiceover
| Repo | Stars | Licence | Note |
|---|---|---|---|
| **[hexgrad/kokoro](https://github.com/hexgrad/kokoro)** | 8.9k | **Apache-2.0** | 82M params, runs on CPU, genuinely clean output. **The commercially-safest free VO in this list** — start here. |
| [RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) | 62k | check repo | Clone a voice from 1 minute of audio. Best quality-per-effort if you want one consistent channel voice. |
| [debpalash/VoiceStudio](https://github.com/debpalash/VoiceStudio) | 34k | check repo | Fully-local ElevenLabs alternative — cloning, dubbing, 646 languages. Relevant to the translation play below. |
| [index-tts/index-tts](https://github.com/index-tts/index-tts) | 24k | ⚠️ **NOASSERTION** | Excellent zero-shot TTS, but a custom licence. Read it before any commercial use. |

Verify the licence on any voice model before you monetise its output — several
strong TTS repos ship non-commercial model weights under a permissive *code*
licence. The repo licence and the weights licence are different things.

### Captions (Shorts retention is ~unwinnable without them)
- **[m1guelpf/auto-subtitle](https://github.com/m1guelpf/auto-subtitle)** — 2.3k. Whisper → burned-in subs, one command. Smallest thing that works.
- [absadiki/subsai](https://github.com/absadiki/subsai) — 1.7k. CLI + Python package + web UI.
- [jdepoix/youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) — 8.4k. Pulls transcripts off *other* channels — the raw material for competitor teardowns.

### Visuals
- **[Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI)** — 134k. The standard. Your existing `product/cosmic-ai-prompt-pack/` prompts drop straight into a batch workflow, turning a manual per-image chore into one run.
- [11cafe/jaaz](https://github.com/11cafe/jaaz) — 6.7k. Local Canva/Manus substitute; useful for thumbnails.

### Editing / assembly
- **[jub0t/Concat](https://github.com/jub0t/Concat)** — 3.2k, Rust. Open-source CapCut replacement with auto-caption and MCP support.
- [GuanYixuan/pyJianYingDraft](https://github.com/GuanYixuan/pyJianYingDraft) — 4.4k. Generates CapCut/JianYing project files from Python — you automate the timeline but keep a human final pass in a real editor. A good middle path if fully-automated output looks too cheap.
- [Hao0321/video-autopilot-kit](https://github.com/Hao0321/video-autopilot-kit) — 2.1k. CapCut JSON + ffmpeg, explicitly built as a fill-in-your-own-data framework. Closest in spirit to this repo.

---

## Tier 3 — Second revenue lines

AdSense on a new channel pays roughly nothing until you're past the partner
threshold. These don't wait for it.

- **[Anil-matcha/ai-creator-academy](https://github.com/Anil-matcha/ai-creator-academy)** — 2.0k. Free curriculum on earning from generative AI: faceless YouTube, UGC ads, AI influencers, print-on-demand, agency work. Read it as market research for pricing `product/faceless-ai-shorts-starter-kit/`, which currently has a sales page but no benchmark.
- **[Anil-matcha/awesome-generative-ai-apps](https://github.com/Anil-matcha/awesome-generative-ai-apps)** — 3.3k. 50+ deployable, monetisable AI app templates, one-click Vercel deploy.
- [shixinzhang/tiktok-viral-hooks](https://github.com/shixinzhang/tiktok-viral-hooks) — small but directly useful: transcripts + extracted hook formulas from viral TikToks. Feed these into `niche.json`'s `hook_templates` rather than inventing hooks.
- [OneInterface/stormy-cookbook](https://github.com/OneInterface/stormy-cookbook) — one API across TikTok/YouTube/Instagram/X for creator search and post data. Turns `analyze_channel.py` from own-channel-only into competitive research.

### Translation arbitrage — the highest-leverage move here
`VoiceStudio` (646 languages) plus `SmartSub` ([buxuku/SmartSub](https://github.com/buxuku/SmartSub), 5.3k — transcribe, translate, dub, burn) means every Short you've already written can ship in 5+ languages. Same script, same visuals, ~5× the inventory, and Spanish/Portuguese/Hindi Shorts face far less competition than English. This is the cheapest multiple available to this repo, because the expensive part — the writing — is already done and sitting in `docs/`.

---

## Tier 4 — If you'd rather sell the tool than use it

`tools/viral_generator.py` is already a product in script form. These wrap it:

- **[wasp-lang/open-saas](https://github.com/wasp-lang/open-saas)** — 16k, MIT. Auth, Stripe/Polar payments, background jobs, S3, landing page.
- [ixartz/SaaS-Boilerplate](https://github.com/ixartz/SaaS-Boilerplate) — 7.4k. Next.js + Tailwind + shadcn, multi-tenancy, roles.

Honest read: this is a *much* longer road than it looks, and the niche-script-generator
space is crowded. It only makes sense after the channel proves the scripts
convert — otherwise you're selling an untested system. Tier 3 first.

---

## Licence summary — the part that decides whether you can charge

| Licence | Repos here | What it means for you |
|---|---|---|
| **MIT** | MoneyPrinterTurbo, youtube-shorts-pipeline, ShortGPT, open-saas | Do anything. Keep the copyright notice. |
| **Apache-2.0** | Pixelle-Video, kokoro | Same, plus a patent grant. Safe. |
| ⚠️ **AGPL-3.0** | OpenMontage, ArcReel | Fine for rendering your own videos. **Poison for a hosted product** — network users get your source. |
| ⚠️ **NOASSERTION** | index-tts | Custom terms. Read them before earning from the output. |

In every case the **videos you generate are yours**. Licences constrain what you
do with the *code*, not the frames it renders.

---

## The recommended stack

Boring, all-permissive, and it closes the gap end to end:

```
tools/viral_generator.py   →  script            (already yours, MIT repo)
  └ tools/to_verticals.py  →  hand-off          (shipped)
hexgrad/kokoro             →  voiceover         (Apache-2.0)
  └ tools/kokoro_vo.py     →  hand-off          (shipped)
ComfyUI + cosmic-ai-prompt-pack → visuals       (GPL-3.0 tool, your prompts)
m1guelpf/auto-subtitle     →  burned captions   (MIT)
youtube-shorts-pipeline    →  assemble + upload (MIT)
```

Sequenced:

1. **Render one Short end to end.** One file, start to finish, no automation. You're finding out where it actually breaks — expect that to be the visuals, not the code.
2. ~~**Wire `viral_generator.py` into the pipeline's script stage.**~~ **Shipped** — see [`tools/to_verticals.py`](../tools/to_verticals.py) and the section below.
3. **Batch the prompt pack through ComfyUI.** The largest manual time sink you currently have, and the one most worth deleting.
4. **Only then automate uploads.** Publishing bad videos faster is not progress, and mass-uploading unreviewed output is how channels get flagged.
5. **Add translation.** Once one language ships reliably, the others are nearly free.

---

## The adapter (shipped)

[`tools/to_verticals.py`](../tools/to_verticals.py) converts `viral_generator.py`
output into the draft JSON that Verticals v3 consumes, so the pipeline starts at
its b-roll stage and never rewrites our voiceover:

```
generate (ours)                    render (theirs)
viral_generator.py --json  ->  [ to_verticals.py ]  ->  verticals produce
```

```bash
# One pipe: generate scripts, convert them, emit a matching niche profile
python tools/viral_generator.py --niche-file niche.json --scripts 5 --use-claude --json \
  | python tools/to_verticals.py --from-json - --niche-file niche.json \
      --niches-dir ../youtube-shorts-pipeline/niches

# Then, in the pipeline's repo
python -m verticals produce --draft ~/.verticals/drafts/<job_id>.json
```

It also writes a niche profile YAML mapped from `tools/niche*.json`, so the
pipeline's voice, captions, music and thumbnail stages run in the channel's tone
instead of falling back to its generic `general` profile.

**It refuses offline scripts by default.** `viral_generator.py` leaves
`[FACT: ...]` research slots in offline mode, and text-to-speech reads those
aloud verbatim — "FACT: the most extreme number or case on record" would end up
in the audio. The adapter skips those scripts and names the slots. Either fill
them in, or generate with `--use-claude`, which writes complete voiceovers.
Pass `--allow-placeholders` to override.

Verified against the pipeline's own code: the drafts resume correctly at the
b-roll stage, carry every key its produce/upload/thumbnail stages read, and the
emitted profile loads as a real niche rather than the `general` fallback.

## The voiceover step (shipped)

The pipeline ships Edge TTS, ElevenLabs, MiniMax, 60db and macOS `say`; Kokoro
is on its roadmap, not in it. [`tools/kokoro_vo.py`](../tools/kokoro_vo.py)
records the voiceover here instead of forking the pipeline, writing the audio
into its work directory and marking the `voiceover` stage done — the same
resume mechanism the script adapter uses:

```
to_verticals.py  ->  [ kokoro_vo.py ]  ->  verticals produce
                        (voiceover)        (b-roll, captions, assemble)
```

```bash
pip install kokoro soundfile && apt-get install espeak-ng   # once
python tools/kokoro_vo.py --draft ~/.verticals/drafts/<job_id>.json --voice af_heart
python -m verticals produce --draft ~/.verticals/drafts/<job_id>.json
```

**Pick the voice deliberately.** Kokoro publishes grades for its own voices and
most are mediocre: only `af_heart` (A), `af_bella` (A-), `af_nicole` (B-) and
`bf_emma` (B-) reach B- or better, and all four are female. The best male
voices are C+ (`am_michael`, `am_fenrir`, `am_puck`), which is worth knowing
before committing a channel to a male narrator — on a faceless channel the
voice *is* the product. `--list-voices` prints the table and the tool warns
before synthesising with anything graded D or below. Voices can also be blended
(`--voice af_heart,af_bella`), and `--speed 0.9`-`0.95` suits ominous narration.

Like the script adapter, it refuses scripts with unfilled `[FACT: ...]` slots —
the same guard, imported rather than duplicated.

### What not to do

- **Don't adopt more than one Tier 1 repo.** They overlap almost entirely; running two means maintaining two.
- **Don't start with ShortGPT** (8.0k, MIT) despite its reputation — last push was 2025-02-10, ~19 months stale, and it's self-described as experimental.
- **Don't automate uploads before you've watched 20 of your own renders.** Full automation with no review is exactly the "inauthentic content" pattern platforms demote.
- **Don't build the SaaS before the channel works.** Tier 4 is the most fun and the least likely to pay this quarter.

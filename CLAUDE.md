# Working with this repo — read before anything else

## The operating constraint: Android phone only

**The owner of this repo works from an Android phone. No laptop, no desktop, no
terminal.** This is not a preference or a temporary situation. It is the single
most important fact about how to help here, and it invalidates the obvious
approach to almost every task.

### What this rules out

They **cannot**:

- Run any command. `python tools/agent.py`, `pip install`, `git`, any CLI tool
  in `tools/` — all of it is unreachable. Never end a message with a command
  and treat that as a delivered answer.
- Navigate a repo of markdown files. Opening `docs/`, following a path, keeping
  two files side by side — none of this works comfortably on a phone.
- Follow **relative markdown links**. This has already broken once: a doc was
  delivered on its own with `](PRODUCTION_PACK_SCAMS.md)`-style links, which
  resolve only on GitHub next to their siblings. Standalone, every link was
  dead. **Never ship a file whose usefulness depends on its neighbours.**

### What to do instead

- **Deliver as a published Artifact.** A single self-contained page, opened with
  one tap, everything inline. This is the working surface — not the repo.
- **Put long text behind copy buttons.** Selecting text by hand on a phone is
  miserable. Any voiceover, prompt, title or description they will paste into
  another app gets its own Copy button.
- **Design phone-first.** ~400px, single column, generous tap targets. Assume
  this is the only screen.
- **Run the tools yourself and hand over the output.** The Python tools in
  `tools/` are genuinely useful — but *you* run them and deliver the result.
  They are your instruments, not the user's.
- **One surface per task.** If producing a video needs a script, prompts and a
  checklist, they all live on one page. Never split across files.

### About `tools/agent.py`

A conversational agent that wraps this toolkit. It was built before the Android
constraint was known, and **the owner cannot run it.** Do not point them at it.
It stays in the repo because it is a working reference and may be usable later
(a cloud shell, or Termux, if they ever want that) — but for now, **you are the
agent**, in whatever chat surface they are talking to you through.

---

## They do not edit. This is a hard blocker, not a preference.

The owner **has CapCut and finds it frustrating. They do not like editing.**
Any plan whose step 3 is "now cut this together" will stall there every time —
that is the real reason nothing has shipped, not laziness and not the scripts.

**Never hand them an edit to do.** Assembling footage, timing cuts, syncing
captions — none of it. If a deliverable needs editing, either you do it or the
plan is wrong.

### Apps they actually have

Gemini, ChatGPT, Qwen (all on the phone), and CapCut (disliked). All three AI
apps can generate images for free — useful, but getting a phone-held image to a
public HTTPS URL is friction, so prefer pipelines that need nothing from them.

### The no-editing pipeline (vidIQ MCP, attached to this session)

This session has vidIQ tools that can produce a finished Short end-to-end, so
the user's only step is uploading the file:

1. `vidiq_voiceover_generate` — narration MP3 from the script text.
2. `vidiq_motion_graphics` — renders animated typography to MP4 with **no source
   footage needed**. This is the key tool: it removes the image-generation step
   entirely. Kinetic typography suits this niche — the channel's own casting
   rule says screens and text carry ~80% of these videos, and several scripts
   (e.g. #1 "The wrong number") are literally about text on a phone screen.
3. `vidiq_compose` — assembles scenes + voiceover + Ken Burns + text overlays
   into a 9:16 MP4. **This is the editing step, done by you.**

There is **no text-to-image tool** in this session. `vidiq_generate_video` does
text-to-video but is priced per second and is expensive.

**Chosen voice: `onwK4e9ZLuTAKqWW03F9` — "Daniel, Steady Broadcaster."** The
news-broadcast register matches the niche's calm/forensic tone. Backup:
`nPczCjzI2devNBz1zQrb` ("Brian, deep, resonant"). Avoid the warm storyteller
voices — warmth reads as gleeful on scam material, which breaks a hard rule.

### Free images: Hugging Face Flux (no credits, but a daily cap)

`mcp__HF_Direct__dynamic_space` -> `evalstate/flux1_schnell` (768x1344, 4 steps)
generates images for **zero credits**. Tuned prompts and the rules that make
them work are in `docs/IMAGE_PROMPTS_FLUX.md`.

**ZeroGPU quota is account-level and daily.** It ran out after ~7 images on
2026-09-20, and switching to another Space does not help — they share the pool.
Roughly one video's worth of images per day, which suits a daily cadence but
blocks batch-producing a week in one sitting. Resets next day.

The egress proxy blocks `*.hf.space`, so images cannot be downloaded and
attached as files — hand over the Space URLs (temporary) or rely on the inline
render.

### Pipeline fit decides the niche — this is new and it overrides the scores

**Image models render atmospheric spectacle beautifully and UI text terribly.**
Proven on 2026-09-20: the "forty phones on a desk" wide shot landed first try
and looked genuinely good; the phone-screen shots took four attempts and one
came back rendering fake UI text reading "Bole 1".

This is structural, not bad luck: **The Setup is *about* screens** — phone
threads, dashboards, banking notifications — so it fights the pipeline on almost
every shot. A spectacle niche (weather, deep sea, animals, cosmic) is all wide
atmospheric scenes with no text, which is exactly what the model does well.

`niche_generator.py` scores these candidates within 72-74/100 of each other, so
it cannot make this call. Pipeline fit should outweigh the score.

### Credits — real money, always confirm before spending

Checked 2026-09-20: **95 credits, free plan (150 cap), resets 2026-10-15.**
Check with `vidiq_balance` (free) before proposing anything.

Free: `vidiq_balance`, `vidiq_voiceover_list_voices`, `vidiq_job_poll`,
`vidiq_video_upload`. Priced: voiceover 14/1000 chars, thumbnail 22, music 25,
titles 5, `vidiq_generate_video` duration x rate x 20. `vidiq_motion_graphics`
and `vidiq_compose` quote at submit.

**Never spend credits without explicit approval.** On 2026-09-20 the user was
offered a full build of video #1 and chose "spend nothing yet" — respect that
until they say otherwise.

**The hard math:** at ~14 credits of narration per video plus render and
compose, 95 credits is roughly two finished videos, not ten. This pipeline
proves the format; it does not sustain a daily channel on the free tier. Say so
honestly rather than burning the balance on two videos and stalling.

---

## Where the channel actually is

- **The pick: The Setup** (`@thesetupexplained`, `tools/niche-scams.json`) —
  scam-mechanics explainers. Decided 2026-09-17.
- **Nothing is live.** No channel created yet, no uploads, no subscribers, no
  analytics. `YOUTUBE_API_KEY` is unset, so `analyze_channel.py` cannot run and
  there is no performance data to reason about. Don't pretend otherwise.
- **The bottleneck is shipping, not ideas.** This repo holds ~54,000 words of
  strategy across six niches and ~35 finished scripts. It does not need more.
  Adding another niche, idea bank or script pack is almost always the wrong
  move — say so plainly if asked, then help them produce and post instead.
- **Next concrete action:** upload #1, "The wrong number" (pig butchering).

### The live working surface

The production deck — Day 0 channel setup plus all 10 scripts with 56 copyable
image prompts, phone-first:

**https://claude.ai/artifact/XZgdvrkdDSwwtGP8mDcanB**

Republish to that same URL to update it (pass it as `url`), rather than creating
a second page and leaving them holding two links.

---

## Content rules that are not negotiable

From `hard_rules` in `tools/niche-scams.json`. These keep the channel monetized
and worth making:

- Explain how victims are **manipulated**, never how to run the play. No
  operational detail, no tooling, no targeting.
- Show it from the victim's side — what they saw, felt, missed.
- Every video ends on **the tell**: concrete and free to act on.
- Never mock victims. The thesis is always "this would work on you too."
- Public, widely reported cases only. No private individuals, no celebrity
  likenesses, no bodycam or courtroom footage.
- Never fabricate a source, statistic or citation.

Parallel rules exist for the other niches: the death/mortality niche is
documentary framing only (never method, never glorification), and the herbal
niche carries no health claims, no dosages, no cures.

---

## Repo map

| Path | What it is |
|---|---|
| `docs/` | Strategy playbooks, script packs, visual packs, thumbnail checklists — one set per niche |
| `docs/PRODUCTION_PACK_SCAMS.md` | The source of truth for the first 10 Shorts: VO + every image prompt inline |
| `docs/GROWTH_STRATEGY_SCAMS.md` | The Setup's launch plan — day-0 setup, the 5 series, 30-day schedule |
| `tools/niche*.json` | Niche configs — pillars, voice, hooks, hard rules. Editing one retunes every tool |
| `tools/*.py` | CLI tools: channel analytics, metadata linter, idea/niche/script generators, the agent |
| `product/` | Sellable digital products built from the system |

Branch for this work: `claude/personal-ai-agent-nsv6ft`.

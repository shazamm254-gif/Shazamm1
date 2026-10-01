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

### Free clips: Flux still -> Wan 2.2 image-to-video (no credits)

`zerogpu-aoti/wan2-2-fp8da-aoti-faster` animates a still into an MP4 (~3.5s
default, 24fps) from an image URL plus a motion prompt. It accepts **a public
URL, and previously generated Space URLs work** — so a Flux output feeds
straight in with no download, which sidesteps the egress proxy block on
`*.hf.space` entirely.

So the whole free pipeline is: **Flux still -> Wan 2.2 clip -> real motion, zero
credits.** Shares the same daily ZeroGPU quota as image generation, and video is
heavier, so expect only a few clips per day. `mcp-tools/wan-2-2-first-last-frame`
interpolates between a start and end frame as an alternative.

**Confirmed working 2026-09-21.** A Flux URL passed straight in as `input_image`
returned a 4s MP4 (steps 6). **`duration_seconds` caps at 5.0** — asking for 7
is rejected outright, so a clip can never cover more than 5s of narration.
Plan shot counts around that: a 25s voiceover needs five or more shots at 1:1,
or the clips get slowed in the edit. Clips cost far more quota than stills —
four images plus four clips exhausted a day's allowance. Note the tool's return value concatenates the video
URL and the seed with no separator — split the trailing digits off before using
the URL. **Neither Claude nor the sandbox can view the result** (the proxy
blocks `*.hf.space` and video is not renderable inline), so the user is the only
one who can judge a clip: hand over the URL and say plainly that it is unviewed.

Paid alternative when quality matters: `vidiq_generate_video` (Veo 3.1, Sora 2,
Kling 3, Seedance, `gemini-omni-flash` is the budget option). Priced per second
and quoted only at submit.

### Stills vs clips is a per-niche decision

**Some niches need motion and some do not, and this drives the whole cost.**

- **Weather, animals, disasters: the subject IS motion.** A tornado, a
  firestorm, a breaking wave. A still with a Ken Burns push reads as a
  slideshow, so these niches want real clips and cost more to make well.
- **Cosmic tolerates stills beautifully.** Space is slow — a slow push into a
  nebula or a drift toward an accretion disk looks exactly like real footage,
  because that is how the real thing moves. Ken Burns is not a compromise here,
  it is accurate.

This is a further point in Cosmic Dread's favour and worth saying out loud when
the niche is in question.

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

Checked 2026-10-01: **3 credits** (free plan, 150 cap, resets 2026-10-15).
On 2026-09-21 it was 67. That's below one 5-credit analytics call.
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

- **The pick: Cosmic Dread** (`@CosmicDread`, `tools/niche.json`) — black
  holes, dying stars, cosmic scale. Chosen 2026-09-20 on pipeline fit: every
  shot is wide atmospheric spectacle with no text and no faces, which is what
  image models do best, and space is slow enough that stills with a pan read as
  real footage. It is also the most complete niche in the repo.
- **The Setup is parked, not dead.** `@thesetupexplained` has 10 scripts, a
  launch playbook and a finished voiceover for Short #1 (in this session's
  history). It fights the pipeline — its shots are phone screens and
  dashboards — so it waits. Don't reopen it unless the user asks.
- **Nothing is live.** No channel created yet, no uploads, no subscribers, no
  analytics. `YOUTUBE_API_KEY` is unset, so `analyze_channel.py` cannot run and
  there is no performance data to reason about. Don't pretend otherwise.
- **The bottleneck is shipping, not ideas.** This repo holds ~54,000 words of
  strategy across six niches and ~35 finished scripts. It does not need more.
  Adding another niche, idea bank or script pack is almost always the wrong
  move — say so plainly if asked, then help them produce and post instead.
- **Next concrete action:** produce Short #1, "Falling Into a Black Hole."
  Voiceover not yet generated (~14 credits); images blocked until the daily
  ZeroGPU quota resets.

### The live working surface

The production deck — all 10 Cosmic Dread Shorts with voiceovers and 40
Flux-tuned image prompts, phone-first. **Version 2 replaced The Setup's deck at
this same URL**, deliberately: one stable link beats two on a phone. The Setup's
deck is reconstructible from `docs/PRODUCTION_PACK_SCAMS.md` if they go back.

**https://claude.ai/artifact/XZgdvrkdDSwwtGP8mDcanB**

Republish to that same URL to update it (pass it as `url`), rather than creating
a second page and leaving them holding two links.

### The Algorithm Killer (in progress, started 2026-10-01)

A retention engine for a Short before it's published. Component 1 is built:
`tools/retention_score.py` scores a script beat by beat; weights and the
ranking signal behind each rule live in `tools/retention_rules.json`;
`tools/algorithm_killer_page.py` renders the phone page. Live page (republish
to the same URL):

**https://claude.ai/artifact/M93xpM1UeCfzew2ceNRAfQ**

Component 2, the rewriter, is built too. Claude writes rewrites as a
proposals JSON in `tools/rewrites/`; `tools/rewrite.py` is the referee and
rejects any rewrite that doesn't lift its beat, breaks a hard rule, adds a
number or name without a source, breaks tone, baits engagement, or asks for
a shot the pipeline can't make (faces, readable text, a clip over 5s). A
hard-rule fix is accepted even when it costs points; a score-only rewrite
may never lower the script's score. Rebuild the whole deck page with
`python tools/algorithm_killer_page.py --deck page.html`.

To score and rewrite a draft the owner pastes in chat: save it as text, run
`retention_score.py --file draft.txt --json out.json`, write a proposals file
with `"text": ...`, run `rewrite.py proposals.json --html page.html`, publish.

Component 3, the packaging scorer, extends `tools/optimize_metadata.py`
(`--short N`, optional `--image frame.png`). It scores the first frame from
Shot 1's Flux prompt against `docs/THUMBNAIL_CHECKLIST.md`, plus on-screen
text, title and description. Each check names its signal and basis, and the
old linter rules with no ranking signal are shown but not scored. Proposals may
carry a `packaging` block (title, onscreen, description, why), a `Shot 1`
replacement, and `retracts` phrases that the description must not repeat.
There's no click-through estimate, by design: Shorts play without a click.
Search demand reads `tools/keyword_demand.json`, which Claude fills from
`vidiq_keyword_research`. It's empty until credits reset; it never guesses.
`measure_frame` (Pillow) has only been tested on synthetic frames, because
*.hf.space images can't be downloaded here.

The tag rule was changed: YouTube Help says tags "play a minimal role" and
excessive tags break spam policy, so the linter no longer asks for 10–15.

Component 4, the feedback loop, is `tools/feedback_loop.py`, tested by
`tools/test_feedback_loop.py` (8 tests, simulated channels with planted
effects). The ledger is **`data/feedback_ledger.json`, committed to git**,
because the container is temporary. Commit and push after every change.
Workflow once a Short is live:
1. `register --short N --video-id ID --published DATE` as soon as the owner
   sends the link. This freezes the prediction before any numbers exist.
2. After 7 days the owner pastes average percentage viewed and viewed vs
   swiped away from the Studio app. Store them with
   `record --source studio --apv X --viewed-pct Y`.
3. Once credits and verification allow, save a `vidiq_channel_analytics`
   response (dimensions video; metrics averageViewPercentage, engagedViews,
   views) to a file and load it with `ingest-vidiq`. The parser hasn't been
   tested on a live vidIQ response.
4. `report` gives rule-by-rule verdicts from 8 videos. `calibrate --apply`
   changes weights only from 20 videos, shrunk toward the prior, and keeps old
   rule versions in `data/rules_history/`.
`analyze_channel.py` no longer requires `YOUTUBE_API_KEY`: without it, it
sends bare requests so an injected header could authorise them. On
2026-10-01 those still got 403 "unregistered callers".

The scorer reads wording, not truth: on #3, #6 and #9 the false lines scored
higher than the corrected ones. Never let the score argue a rule fix away.

Facts established while building it — don't re-derive:

- **Narration pace is 2.45 words/s**, measured from Short #1 (63 spoken
  words in 25.5s). The scorer uses it to time beats and find the 2s mark.
- **Cosmic `hard_rules` are approved** (owner, 2026-10-01). They live in
  `tools/niche.json` and are listed under "Content rules" below. Checking the
  10 existing scripts against them found #2 factually wrong (light *can* cross
  10 billion light-years in 13.8 billion years) and its structure disputed,
  #3 wrong on timing (Caltech: about -100°F after a year; the air freezes far
  later), #6 inventing a threat ("fling Earth out of orbit … It would already
  be too late"), and #9 overstating a gamma-ray burst and ending on "One may
  already be on its way". All five have checked rewrites in `tools/rewrites/`
  (#1 for retention). The doc itself is not yet updated with them.
- **The YouTube Data API key is not reaching this environment.** A real call
  on 2026-10-01 returned 403 "unregistered callers": no key, no injected
  `X-Goog-Api-Key` header.
- **The Data API cannot return retention at any key level.** Average
  percentage viewed and viewed-vs-swiped-away need the YouTube Analytics API
  with the channel owner's OAuth, or YouTube Studio. The feedback loop must
  get retention another way: vidIQ's connected-channel tools, or the owner
  reading two numbers off the Studio app.
- **vidIQ is the retention route.** `vidiq_channel_analytics` returns
  `averageViewPercentage`, `engagedViews` and the per-video drop-off curve
  (`report: audience_retention`). The vidIQ account already has one channel
  connected, `UCTTxQCp98YU2eYiWIwXwslg`. Not yet confirmed to be @CosmicDread.
  On 2026-10-01 `vidiq_authorize_with_youtube` returned
  `verification_required` (YouTube MFA), which only the owner can complete.
  Every analytics call costs 5 credits.
- **youtube.com is blocked by the egress proxy**, so a channel can't be
  checked from its public page.

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

Cosmic Dread (the active niche) has its own, from `hard_rules` in
`tools/niche.json`, approved by the owner on 2026-10-01:

- Every number, name and mechanism matches a mainstream source (NASA, ESA,
  peer-reviewed). Contested values: say "about" or use the conservative one.
- Hypotheticals stay labelled as hypotheticals.
- No invented imminent threat to Earth. The dread comes from scale and time.
- Never fabricate a source, quote, statistic or "scientists say".
- Awe and unease, never despair aimed at the viewer's own life.
- AI visuals are illustrations: tick YouTube's altered-or-synthetic disclosure
  for photoreal shots of real objects or places; never call one a photo.
- No NASA/ESA logos, real mission footage, copyrighted music or likenesses.
- Every Short is written for its topic: no noun-swapped templates, no batches
  of near-identical videos (YouTube's inauthentic-content policy).

Parallel rules exist for the other niches: the death/mortality niche is
documentary framing only (never method, never glorification), and the herbal
niche carries no health claims, no dosages, no cures.

---

## Repo map

| Path | What it is |
|---|---|
| `docs/` | Strategy playbooks, script packs, visual packs, thumbnail checklists — one set per niche |
| `docs/IMAGE_PROMPTS_FLUX_COSMIC.md` | **Active niche.** All 10 Cosmic Shorts: VO + 40 Flux-tuned prompts |
| `docs/PRODUCTION-PACK.md` | The original Cosmic pack (Midjourney-era prompts — prefer the Flux file) |
| `docs/IMAGE_PROMPTS_FLUX.md` | The Flux prompt rules, worked through on the scam niche |
| `docs/PRODUCTION_PACK_SCAMS.md` | The Setup's 10 Shorts — parked |
| `docs/GROWTH_STRATEGY_SCAMS.md` | The Setup's launch plan — day-0 setup, the 5 series, 30-day schedule |
| `tools/niche*.json` | Niche configs — pillars, voice, hooks, hard rules. Editing one retunes every tool |
| `tools/*.py` | CLI tools: channel analytics, metadata linter, idea/niche/script generators, the agent |
| `product/` | Sellable digital products built from the system |

Branch for this work: `claude/personal-ai-agent-nsv6ft`.

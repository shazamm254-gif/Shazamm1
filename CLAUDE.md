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

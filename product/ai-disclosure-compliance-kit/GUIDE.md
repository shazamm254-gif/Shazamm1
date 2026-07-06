# The AI Disclosure & Compliance Playbook

A no-fluff guide to the disclosure rules every AI-content creator now has to
follow — what they're for, when they apply to *your* video, and how to build
compliance into your posting workflow so it costs you zero extra thought
after the first week.

> **Why this became mandatory:** platforms got flooded with realistic
> synthetic media — AI voices of real people, AI news anchors, fabricated
> footage of real events — and regulators followed. YouTube, TikTok, and Meta
> all rolled out disclosure requirements for "realistic" AI content, and the
> EU AI Act added a legal transparency obligation for synthetic/deepfake
> media on top of platform policy. If you run a faceless AI channel, some
> share of your uploads almost certainly falls inside these rules.

---

## 1. The one-question test

Before anything else, ask **one question about each video**:

> **Could a reasonable viewer mistake this for real, unaltered footage of a
> real person, place, or event — even briefly?**

- **Yes →** it very likely needs disclosure. Keep reading.
- **No, it's obviously stylized/animated/clearly synthetic** (cosmic
  illustrations, stylized 3D renders, cartoon-style explainer visuals,
  obvious sci-fi CGI) **→** disclosure requirements generally don't apply,
  because nobody could mistake it for reality.

The trigger isn't "did I use AI" — plenty of AI-assisted content (an AI voice
reading your own script over clearly-illustrated visuals, subtitle
generation, background music) needs no disclosure at all. The trigger is
**realism that could be mistaken for an unaltered recording of something
real.**

---

## 2. The decision flowchart

Walk through these in order for any video you're unsure about:

1. **Does it depict a real, identifiable person** saying or doing something
   they didn't actually say or do (including a cloned voice)? → **Disclose.**
2. **Does it depict a realistic scene, place, or event that didn't actually
   happen**, presented as if it did (a "photorealistic" fabricated news
   event, a real location altered to show something that isn't there)? →
   **Disclose.**
3. **Is it altered footage of a real event** in a way that changes what
   viewers would understand happened (cutting/splicing/generative-fill on
   real footage to change the outcome or context)? → **Disclose.**
4. **Is it a synthetic voice or face used to narrate/host your channel in a
   way that could pass as a real human being** (not clearly a stylized
   avatar)? → **Consider disclosing** — some platforms are moving this
   direction even outside strict "realistic person" cases.
5. **None of the above — it's illustrated, stylized, obviously CGI, or the
   AI use is purely production (script, subtitles, editing, music)?** → No
   disclosure needed under current major-platform rules.

**Faceless-AI-channel specifics:**
- Stylized cosmic/mythology/history illustration Shorts (this repo's default
  niche): usually **no disclosure needed** — nothing reads as a real
  recording of a real thing.
- An AI-generated "photorealistic" recreation of a historical event, a
  realistic AI anchor/host, or any clip that looks like real footage of a
  real place or person: **disclose.**
- When in doubt, disclose. It costs one toggle and a line of text; the
  downside of skipping it is your account standing.

---

## 3. Platform-by-platform: what to actually do

**YouTube — "Altered or synthetic content" disclosure**
- In YouTube Studio, when uploading (or editing an existing video):
  **Content details → Show more → Altered content**, and toggle on the
  question about realistic altered/synthetic media.
- Disclosed videos get a label (visible in the description/expanded info,
  and a more prominent on-video label for sensitive topics like health,
  news, elections, or finance).
- Not disclosing when required is a **policy violation** — YouTube can add
  the label itself, remove the video, or apply penalties up to suspension
  from monetization/the YouTube Partner Program for repeated violations.

**TikTok — AI-generated content (AIGC) label**
- TikTok requires an **"AI-generated content" label** on realistic AI media,
  applied via the "AI-generated content" toggle in the post settings
  (Content Disclosure). TikTok's own AI effects auto-label; content made
  with outside tools needs the manual toggle.
- TikTok also auto-detects and may auto-label unlabeled synthetic media
  using C2PA-style metadata — don't count on your own upload going
  unnoticed.

**Instagram / Facebook (Meta) — "AI info" label**
- Meta requires labeling of photorealistic AI images/video/audio via the
  **"AI info"** disclosure in post settings, and will auto-apply a label if
  it detects industry-standard AI markers (C2PA metadata) even if you don't
  self-disclose.
- Undisclosed realistic AI content that Meta later detects can be labeled
  after the fact or actioned under its manipulated-media policy.

**Beyond platform policy — the legal layer**
- The **EU AI Act** imposes its own transparency obligation: AI-generated or
  manipulated audio/image/video content that resembles real people, objects,
  places, or events, and would falsely appear authentic, must be disclosed
  as artificially generated/manipulated — a legal requirement layered on top
  of whatever the platform enforces.
- Several jurisdictions (and a growing list of individual laws) separately
  require disclosure for AI political ads/deepfakes and AI content depicting
  real people. If your content touches real people, current events, or
  political topics, treat disclosure as non-negotiable, not optional.

> Screens, toggle names, and menu locations change often. This section gives
> you the *shape* of each platform's requirement; confirm the exact current
> steps in that platform's creator/help center before publishing anything
> borderline (real people, real events, sensitive topics).

---

## 4. What disclosure does — and doesn't — cost you

**Myth:** "If I flag it as AI, the algorithm will bury it."
**Reality:** Platforms have stated publicly that a disclosure label does not
by itself reduce reach or recommendations. Distribution is driven by
engagement signals, same as always.

**What actually gets punished:**
- Not disclosing when required (removal, forced labeling, strikes, loss of
  monetization eligibility, account-level penalties for repeat violations).
- Content that's misleading regardless of disclosure (e.g., realistic
  fabricated footage of real people in harmful contexts) — disclosure
  doesn't excuse content that otherwise violates misinformation/harassment
  policy.

**Disclosure vs. monetization eligibility — two separate systems:**
Don't confuse this kit with the separate "original content" bar the YouTube
Partner Program applies to mass-produced/reused AI content (the
slideshow-spam problem covered in the Faceless AI Shorts Playbook). You can
be fully, correctly disclosed on every video and *still* fail the "original
and authentic" monetization bar if your content is low-effort and
templated — and conversely, a fully original, high-effort video can still
require disclosure if it's realistic synthetic media of a real person or
event. **Handle both.** Disclosure keeps you off a violation list; original
value is what keeps you eligible for ad revenue.

---

## 5. Build it into your workflow (so it's free after week one)

Add **one step** to your existing upload checklist (the same one from
`optimize_metadata.py` in this repo's toolkit): before you hit publish, run
the one-question test from §1. If yes, toggle disclosure on that platform's
upload flow and paste the description snippet from `TEMPLATES.md`. That's
the entire recurring cost — seconds per upload, once it's a habit.

Keep the audit log (`TEMPLATES.md` §4) updated weekly. If a platform ever
flags one of your videos, a dated record showing you have a real compliance
process is the difference between "isolated mistake" and "pattern of
violations" in any appeal.

---

### The whole system in one line

**One question (could this be mistaken for real?) → toggle the disclosure
the platform provides → paste your disclosure text → log it → publish.**
Five seconds of friction buys you a channel that never gets blindsided by a
policy update.

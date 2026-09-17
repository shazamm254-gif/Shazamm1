# The Setup — YouTube Shorts Launch & Growth Playbook

The launch plan for **The Setup** (`@thesetupexplained`) — how elaborate scams
actually work, in 45-second hits. Niche config: `tools/niche-scams.json`.

This is written for a channel at **zero**: no uploads, no subscribers, no
analytics. Everything you need to produce the videos already exists —
[`PRODUCTION_PACK_SCAMS.md`](PRODUCTION_PACK_SCAMS.md) is self-contained for the
first ten. What's been missing is the plan around them. That's this file.

> **Read this once, then stop reading.** The bottleneck on this channel is not
> strategy — there are already ~54,000 words of it in this repo. The bottleneck
> is upload #1. Section 7 is the only part you need open while you work.

---

## 0. Why this niche wins

- **Built-in demand, unusual headroom.** True crime is the most reliably watched
  genre online, but it's saturated with *case recaps*. Mechanism explainers —
  "here is the exact psychological lever" — are a much thinner field.
- **The audience is two audiences.** People who think they're too smart to be
  scammed, and the parents they worry about. The first group shares out of
  fascination, the second out of fear. Both are strong sharing motives.
- **Evergreen with a news tailwind.** Lustig selling the Eiffel Tower works
  forever; deepfake fraud rides every AI headline. Mix both and the back
  catalogue keeps earning while new uploads catch waves.
- **Genuinely faceless.** Silhouettes, hands, screens and text carry ~80% of
  these videos. No presenter, no likeness risk, no consistency problem.
- **Every video is a public service.** That's not a nicety — it's why this
  survives moderation, earns comments that aren't cynical, and stays monetized.

---

## 1. The one thing that matters most: the first 2 seconds

Every Short lives or dies on the swipe. Lead with the **outcome**, never the
setup.

| Weak (setup first) | Strong (outcome first) |
|---|---|
| "In 2024, a finance worker in Hong Kong received a message…" | "He joined a video call with seven colleagues. Every one was a deepfake." |
| "Romance scams are a growing problem online." | "'Sorry, wrong number.' That's the opening move of a billion-dollar scam." |
| "Let's talk about why scam emails look so fake." | "That scam email is badly written on purpose." |

Three hook shapes that work in this niche specifically:

1. **The impossible fact.** State the thing that shouldn't be true. "Every person on that call was generated."
2. **The inversion.** Take what the viewer already believes and flip it. "The typos are a filter."
3. **The near-miss.** Put them inside it. "She heard her daughter crying down the phone. Her daughter was asleep upstairs."

**Never open with a question.** "Have you ever wondered how scams work?" is a
swipe. The viewer answers "no" with their thumb.

---

## 2. Packaging: title, first frame, hashtags

- **Title = the search term + the hook.** Your `title_keywords` in
  `niche-scams.json` are what people actually type: *pig butchering scam
  explained*, *AI voice clone scam*, *ponzi scheme explained*. Work one in.
  "The scam that looked fake" ranks for nothing; "Why this fake-looking scam
  actually worked — pig butchering explained" ranks.
- **Run every title through the linter before you upload.** It takes 5 seconds:
  ```bash
  python tools/optimize_metadata.py --title "..." --description "..." --tags ...
  ```
- **First frame = one ordinary object, one thing wrong.** Full spec in
  [`THUMBNAIL_CHECKLIST_SCAMS.md`](THUMBNAIL_CHECKLIST_SCAMS.md). No hooded
  hackers, no green code rain, no real brand marks.
- **Hashtags:** `#scams #truecrime #psychology #fraud #scamalert #shorts`.
  Always include `#shorts` — it's how YouTube reliably classifies the upload.
- **Description = the mechanism in one line, then the tell.** It's read by the
  algorithm more than by humans. "They let you win $500 so you'd never test it
  again. That's the entire mechanism."

---

## 3. Content system: series, not one-offs

Five runnable series, already mapped to concepts in
[`IDEA_BANK_SCAMS.md`](IDEA_BANK_SCAMS.md):

| Series | What it is | Why it earns its place |
|---|---|---|
| **Nobody Falls For This** | Short, punchy single-mechanism videos | Cheapest to make, highest replay |
| **The Setup** | Slow-burn victim-perspective narratives | Best watch time, best comments |
| **Legendary Cons** | Period pieces — Lustig, Poyais, forgery | Best shares, best evergreen life |
| **Legal But Not Honest** | Dark patterns, near-misses, subscription traps | Best debate in comments |
| **How It Collapsed** | Corporate autopsies — OneCoin, Ponzi mechanics | Best for 60s, seeds future long-form |

Name the series on-screen in the first frame. It trains people to expect a
format, which is what turns a viewer into a subscriber.

---

## 4. Cadence: the realistic schedule

- **Target 1/day. Accept 5/week.** Frequency buys algorithmic at-bats while
  you're small. Consistency beats polish at this stage — every time.
- **Batch, never one at a time.** One session: generate all images for 5
  scripts. Next session: record all 5 voiceovers back to back. Next: edit all
  5. Producing one video end-to-end is how channels die in week two.
- **You already have 10 scripts.** That is two full weeks. Do not write an
  eleventh until all ten are published.
- **Posting time:** you have no data yet, so start 6–9pm in your main audience's
  timezone. After ~10 uploads, run `python tools/analyze_channel.py --channel
  "@thesetupexplained"` and switch to what it reports.
- **Lock the look on video #1.** One voice, one music bed, one palette, one
  caption style. Changing it later costs you the brand recognition you're
  building.

---

## 5. Retention craft: the 6-beat structure

Every script in this niche fits the same skeleton — which is precisely why the
channel can post daily:

1. **0–3s — The impossible fact.** The outcome, not the setup.
2. **3–10s — Make it normal.** Why the victim's behaviour was reasonable. **This is the retention beat.** Cut it and the video becomes mockery, and mockery doesn't get shared by the people it's protecting.
3. **10–25s — The mechanism.** One clean idea. Never two.
4. **25–40s — The escalation.** The step where retreating got expensive.
5. **40–50s — The tell.** Concrete, and free to act on.
6. **50–60s — The turn.** One sentence that reframes the whole thing and loops back to the hook, so the video replays.

Editing rules: cut every 1.5–3 seconds. No dead air before the hook. Captions
burned in — most viewers watch muted. Voice calm, low, forensic, never gleeful;
slow the AI voice ~10% for the documentary feel.

---

## 6. Turn viewers into a community

- **Pin the tell as the first comment.** "Family safe word. Free, takes 30
  seconds, works even when the voice is perfect." It's the most useful thing on
  the video and it anchors the comment section usefully.
- **The comments are the moat.** People will reply with what happened to them or
  their parents. Those replies are your next 50 scripts, and they're free.
- **Reply to every comment for the first 30 days.** Engagement early is
  disproportionately valuable, and it's the only marketing you have.
- **Never let the comments turn into victim-blaming.** The thesis is always
  *this would work on you too*. Say it out loud when the thread drifts — it's
  the brand.

---

## 7. The 30-day launch plan

### Day 0 — Channel setup (about 30 minutes, do it before producing)

Paste-ready copy:

- **Name:** The Setup
- **Handle:** `@thesetupexplained`
- **Tagline / banner line:** *How elaborate scams actually work.*
- **About section:**

  > How elaborate scams actually work — the psychology, the mechanics, and the
  > moment the mark realizes.
  >
  > Every video explains how the deception works from the victim's side, and
  > ends on the tell that would have broken it. Never how to run it. Never
  > mockery. The thesis is always: this was built to work on you.
  >
  > Public, widely reported cases only. New Short most days.

- **Profile image:** one cold blue-lit object on near-black — same visual
  language as the thumbnails. The style suffix in
  [`VISUAL_PACK_SCAMS.md`](VISUAL_PACK_SCAMS.md) will generate it.

### Week 1 — The first five

Launch order is chosen for hook strength, production cost, and series variety —
not the order they appear in the pack.

| Day | Script | Series | Why here |
|---|---|---|---|
| 1 | **#1 The wrong number** | The Setup | Strongest hook you have. Lead with your best. |
| 2 | **#4 The typos are on purpose** | Nobody Falls For This | Cheapest to produce, pure inversion, high replay |
| 3 | **#3 The voice was hers** | Nobody Falls For This | Highest search demand right now; the safe-word tell is shareable |
| 4 | **#10 Why gift cards** | Nobody Falls For This | The most practically useful video on the channel |
| 5 | **#2 Everyone on the call was fake** | The Setup | The $25M number does the sharing for you |

### Week 2 — The second five

| Day | Script | Series |
|---|---|---|
| 8 | **#7 Sold the Eiffel Tower** | Legendary Cons |
| 9 | **#5 Two cherries and a bar** | Legal But Not Honest |
| 10 | **#9 The call that warns you** | The Setup |
| 11 | **#6 The coin with no blockchain** | How It Collapsed |
| 12 | **#8 He invented a country** | Legendary Cons |

### Weeks 3–4 — Read the data, then feed it

- Run `analyze_channel.py`. You now have real numbers for the first time.
- Find your best performer. Make **three more in that exact series** before
  anything else. This is the whole game: the algorithm has told you what it
  wants, so give it more.
- Pull your next 10 from [`IDEA_BANK_SCAMS.md`](IDEA_BANK_SCAMS.md) — 40 ranked
  concepts remain, each with hook, retention driver and thumbnail already
  specified.
- Mine the comments for what people ask about. Those become scripts 21–30.

---

## 8. What success looks like, in order

Don't measure subscribers first. They're the last thing to move.

1. **10 uploads published.** The only metric that matters in week two. Most channels never reach it.
2. **One video outperforms the others by 5×.** That's the algorithm finding your audience. Make more of that one.
3. **Comments from people it happened to.** Proof you've hit the emotional register, and your best source of new scripts.
4. **Average view duration above 70%.** Check in Studio, not here — public stats don't show it. This is the number that decides whether the channel compounds.
5. **Subscribers.** They follow the four above. They never lead.

---

## The line this channel does not cross

From `hard_rules` in `tools/niche-scams.json` — these are not stylistic
preferences, they're what keeps the channel monetized and worth making:

- Educate about the deception, **never** provide operational instructions.
- Show the manipulation from the victim's side — what they saw, felt, missed.
- Every video ends on the tell, the warning sign, or how it was exposed.
- Never mock victims. The thesis is always "this would work on you too."
- Public, widely reported cases only. No naming private individuals.
- No celebrity likenesses, no bodycam or courtroom footage, no copyrighted assets.

The safe framing is also the highest-retention framing. The "make it normal"
beat is what stops this being a channel that laughs at people — and it's the
beat that holds the audience.

---

### Tooling quick reference

```bash
# Ask the agent — it knows this niche, the rules, and your docs
python tools/agent.py --niche-file niche-scams.json

# Score packaging before every upload
python tools/optimize_metadata.py --title "..." --description "..." --tags ...

# Fresh hooks in this niche's voice
python tools/generate_ideas.py -n 20 --niche-file niche-scams.json

# Once you have ~10 uploads: what's actually working
python tools/analyze_channel.py --channel "@thesetupexplained"
```

| Need | File |
|---|---|
| Produce the first 10 (VO + all image prompts, phone-friendly) | [`PRODUCTION_PACK_SCAMS.md`](PRODUCTION_PACK_SCAMS.md) |
| Full scripts with sources | [`SCRIPT_PACK_SCAMS.md`](SCRIPT_PACK_SCAMS.md) |
| Shot-by-shot image prompts + style suffixes | [`VISUAL_PACK_SCAMS.md`](VISUAL_PACK_SCAMS.md) |
| First frame / thumbnail spec | [`THUMBNAIL_CHECKLIST_SCAMS.md`](THUMBNAIL_CHECKLIST_SCAMS.md) |
| The next 40 concepts, ranked | [`IDEA_BANK_SCAMS.md`](IDEA_BANK_SCAMS.md) |

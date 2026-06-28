# Templates & Vault

Copy-paste templates to run your channel. Fill in the brackets.

---

## 1. Channel / Niche Config

Drop this into `tools/niche.json` and fill it in. Every tool in the kit reads
from this one file — change it and the whole toolkit retunes to your niche.

```json
{
  "channel_name": "[Your Channel Name]",
  "handle": "@[YourHandle]",
  "one_line": "[One sentence: what your channel is about and the feeling it gives]",
  "pillars": [
    "[Content pillar 1]",
    "[Content pillar 2]",
    "[Content pillar 3]",
    "[Content pillar 4]"
  ],
  "audience": "[Who watches this and what they're curious about]",
  "tone": "[The voice — e.g. ominous documentary, hype energetic, calm explainer]",
  "core_hashtags": ["#[tag1]", "#[tag2]", "#[tag3]", "#[tag4]", "#[tag5]"],
  "extra_hashtags": ["#shorts", "#[tag]", "#[tag]", "#[tag]", "#[tag]"],
  "hook_templates": [
    "This is what happens when {subject} {event}.",
    "Scientists discovered {subject}. The result is terrifying.",
    "What if {event}? Here's the answer.",
    "Nobody talks about {subject}. Here's why they should.",
    "The {subject} you were never told about.",
    "{subject} shouldn't be possible. But here it is."
  ],
  "title_keywords": ["[keyword]", "[keyword]", "[keyword]", "[keyword]"]
}
```

> The `{subject}`, `{event}`, etc. placeholders get filled by the idea
> generator. Add your own template lines — the more, the more varied your ideas.

---

## 2. Short Script Template

Use this for every Short. Target ~2.5 words/sec of voiceover (a 20s Short ≈ 50
words). See `docs/FIRST_10_SHORTS.md` for 10 fully worked examples.

```
TITLE:        [<60 chars, hook word first, niche keyword, no hashtags]
SERIES:       [Which of your 3–4 series this belongs to]

HOOK (0–2s):  [Exact words on screen + spoken in frame 1 — the payoff, not a build-up]
ON-SCREEN:    [≤4 big words, top third]

VO:           [Full narration, ~40–60 words, tight and in your channel's voice]

VISUALS:      [What to generate; cut every 1.5–3s — shot 1 → shot 2 → shot 3 → shot 4]

END:          [A loop line back to the hook, or a question that invites a comment]

DESCRIPTION:  [2–3 lines of context + subscribe CTA]
              [#shorts + your core hashtags + 1–2 specific tags]
TAGS:         [10–15 tags, broad + specific]
```

---

## 3. Hook Vault (100+ openers)

Swap your subject/scenario into any of these. Group A grabs; Group B builds
curiosity gaps; Group C uses stakes/scale; Group D uses controversy/contrast.

**A — Instant grab**
1. This is what happens when {X}.
2. You weren't supposed to see this.
3. This shouldn't exist. But it does.
4. Watch what {X} does next.
5. Nobody believes this is real.
6. This is the most {adjective} {thing} ever recorded.
7. Stop scrolling — you need to see {X}.
8. Something is wrong with {X}.
9. This {thing} broke the rules.
10. They tried to hide {X}.

**B — Curiosity gap**
11. What if {scenario}? Here's the answer.
12. Here's why {X} happens — and it's not what you think.
13. The real reason {X} is {Y}.
14. Everyone gets {X} wrong. Here's the truth.
15. The {thing} you were never told about.
16. There's a reason {X}. Nobody talks about it.
17. What's really inside {X}?
18. The secret behind {X}, in 30 seconds.
19. You've seen {X}. You've never seen *this*.
20. The question {experts} can't answer about {X}.

**C — Stakes & scale**
21. Scientists simulated {X}. The result is terrifying.
22. {X} is bigger than you can imagine. Here's proof.
23. If {event} happened tomorrow, this is what survives.
24. This is what {X} looks like at full scale.
25. {X} could end everything. Here's how.
26. In {timeframe}, {X} will be unrecognizable.
27. The last {thing} on Earth won't look like you'd expect.
28. {Number} {things} that shouldn't be possible.
29. This is the most dangerous {thing} in {place}.
30. {X} is closer than you think.

**D — Controversy & contrast**
31. Everything you know about {X} is wrong.
32. {X} vs {Y} — the answer will surprise you.
33. They said {X} was impossible. It wasn't.
34. {X} used to be {Y}. Now look at it.
35. Why {common belief} is a lie.
36. The truth about {X} they don't want viral.
37. {X} is real — and that's the scary part.
38. You're not ready for what {X} actually is.
39. This changes everything about {X}.
40. Forget what you heard about {X}.

> The kit's idea generator (`tools/generate_ideas.py`) turns templates like these
> into finished hooks automatically. Add your best ones to `hook_templates` in
> your niche config so the generator uses them.

*(Mix and reskin these freely — 40 templates × your subjects = hundreds of
unique hooks.)*

---

## 4. Posting Calendar (weekly batch)

| Day | Task |
|---|---|
| **Mon** | Ideate 15–20 + script the week's batch |
| **Tue** | Generate all visuals |
| **Wed** | Record all voiceovers + edit |
| **Thu** | Finish edits, write all titles/descriptions, run the metadata linter |
| **Fri** | Schedule the week, set custom thumbnails |
| **Daily** | One Short publishes; reply to comments in the first hour |
| **Weekly** | Re-run the analyzer; note your top performer and make more like it |

---

## 5. Thumbnail / First-Frame Checklist (quick version)

- [ ] One clear subject, large in frame
- [ ] Your most striking visual — never a title card or logo
- [ ] High contrast; reads at fingernail size
- [ ] ≤4 words of bold text, top third (UI covers bottom/right)
- [ ] Raises a question instead of answering it
- [ ] Looks like the rest of your channel (same font + color signature)

Full version: `docs/THUMBNAIL_CHECKLIST.md`.

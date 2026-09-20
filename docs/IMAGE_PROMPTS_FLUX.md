# Flux-tuned image prompts — The Setup

The prompts in `PRODUCTION_PACK_SCAMS.md` and `VISUAL_PACK_SCAMS.md` were
written for Midjourney. **They fail on Flux**, which is what the free Hugging
Face Space (`evalstate/flux1_schnell`, 768x1344, 4 steps) runs. This file holds
the re-tuned versions that actually render, plus the rules learned from tuning.

## The three rules

1. **Never lead with darkness.** "near-black background, deep shadow, single
   hard light source" returns an almost entirely black frame. Make the *screen*
   the light source instead: "cold blue-white screen glow lighting a dark room."
2. **Say the bubbles are empty, explicitly.** Flux cannot render readable UI
   text — it produces convincing-looking gibberish, which looks amateurish on a
   channel about scams. The phrase that fixes it is **"completely empty with no
   writing on it"** / "totally blank bubbles with no writing inside". The result
   is clean and graphic, and leaves room for real text in the editor.
3. **Where text is unavoidable, throw it out of focus.** "deliberately soft out
   of focus so nothing is readable" turns garbled numbers into plausible
   background detail (works well for dashboards and tickers).

Also: say "photograph" or "cinematic photorealistic", keep prompts near 60–70
words, and name one accent colour rather than a whole palette.

## Short #1 — "The wrong number"

Seeds are recorded so any shot can be regenerated identically.

### Shot 1 · 0–3s · hook (also the thumbnail) — seed 135303078
> One single small empty grey chat bubble alone at the top of a completely blank dark phone screen, the bubble is totally empty with no writing inside it, vast empty black space below, extreme close-up, dark mode messaging app, cold blue-white screen glow, muted slate grey, minimal, clinical, cinematic photorealistic, shallow depth of field, fine film grain

Renders one blue bubble on black with the lower two-thirds empty — that empty
space is where `SORRY, WRONG NUMBER` goes.

### Shot 2 · 3–14s · months of history — seed 860802734
> A long unbroken vertical column of hundreds of empty chat message bubbles stacked up a phone screen and receding upward into darkness like a ladder, completely blank bubbles with no writing on them, dark mode messaging app, endless conversation history, cold blue-white screen glow, muted slate blue and grey, cinematic photorealistic, soft focus falloff, fine film grain

The strongest of the set. Scroll it upward continuously — the length is the point.

### Shot 3 · 14–28s · the chart climbs — seed 2126971591
> An abstract crypto trading dashboard on a dark screen, a rising line chart climbing steeply and stacked numeric panels glowing sickly green, deliberately soft out of focus so nothing is readable, shallow depth of field, dark room, cold blue ambient light mixed with green screen glow, cinematic photorealistic, moody, fine film grain

### Shot 4 · 28–38s · the $500 lands — seed 2017167614
> A small blank banking notification card sliding onto a phone screen at night, the card is completely empty with no writing on it, plain rounded rectangle, phone lying on a dark wooden kitchen table, cold blue-white glow from the screen, utterly mundane domestic scene, muted grey and slate blue, cinematic photorealistic, shallow depth of field, fine film grain

### Shot 5 · 38–50s · payoff + loop — seed 1158823191
> Wide overhead shot looking straight down at a long bare industrial desk holding forty identical smartphones face up in neat rows, every screen glowing faint blue in a dark windowless room, one empty office chair, no people, cold clinical surveillance atmosphere, muted grey and slate blue, cinematic photorealistic, moody low-key lighting, fine film grain

The payoff. Pull back slowly; hold; cut to black.

## Voiceover

`vidiq_voiceover_generate`, voice `onwK4e9ZLuTAKqWW03F9` (Daniel, Steady
Broadcaster). Script #1 ran 662 chars to **50.05s** — comfortably inside the
60-second Shorts limit. Budget 14 credits per script at this length.

## Note on delivery

The sandbox's egress proxy blocks `*.hf.space`, so generated images cannot be
downloaded server-side and attached as files — hand the user the Space's image
URLs to save directly, or render them inline. The vidIQ S3 voiceover URLs are
reachable and can be downloaded and attached (they expire in 12 hours).

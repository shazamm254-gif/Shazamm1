# The Setup — Visual Pack (Top 10)

Shot-by-shot AI image/video prompts for all 10 scripts in
[`SCRIPT_PACK_SCAMS.md`](SCRIPT_PACK_SCAMS.md). Copy a prompt, append the
**master style suffix for that lane**, add your 9:16 flag, and generate. Every
shot lists edit timing and a motion note for video generators (Runway / Kling /
Pika / Veo).

Shot counts and timings match the scripts exactly — 46 shots across 10 videos,
43–47 seconds of narration plus a closing line, cutting every 3–13s depending on
the beat.

> Generate 3–4 variations per shot and keep the *coldest* one. This niche dies
> when it looks dramatic. Shot 1 doubles as your thumbnail unless a dedicated
> thumbnail prompt is listed.

---

## The four rules (read before you generate anything)

**1 — No real brands, logos, or institution names.** Not in the image, not in
the prompt. Invent them: `NORTHBANK`, `MERIDIAN TRUST`, `CASCADE PAY`. A real
bank's logo on a video about fraud is a trademark problem and a defamation
problem at the same time, and it adds nothing — viewers read "bank app" from
layout alone. Every prompt below is written with fictional or unnamed brands.

**2 — Never generate a usable fake artifact.** No convincing replica of a real
bank's login page, a real company's invoice, or a working QR code. Keep fake
interfaces obviously generic and slightly abstracted — that's the honest choice
*and* the better shot, because a stylized interface reads faster on a phone than
a photoreal screenshot does.

**3 — No real people's faces, ever.** Silhouettes, hands, backs of heads,
figures out of focus. For the historical scripts (#7, #8), use period objects,
rooms and light instead of faces — a hat stand and a letterhead carry 1925
better than a generated portrait, and generated portraits of real historical
figures age badly and invite likeness complaints.

**4 — Don't generate the text. Overlay it.** Image models still mangle small
type, and half this channel *is* type — message threads, URLs, invoice digits.
Generate the container (a phone in a dark room, an empty email window) and set
the actual words in your editor. Everything below is prompted that way: you'll
see "blank message bubbles", not "a message reading…". This is the single
biggest time-saver in the pack.

---

## The two master style suffixes

This channel runs two visual lanes. **Never mix them inside one video** — the
palette should tell the viewer which series they're in before you speak.

### Lane A — Modern (scripts #1, #2, #3, #4, #5, #6, #9, #10)

```
cold forensic documentary still, photorealistic, ultra-detailed, near-black
background, single hard light source, deep shadow, desaturated grey-blue
palette with one cold UI-blue accent, subtle screen glow, anonymous and
clinical, faint film grain, no text, no logos, 8k
```

**Example (Midjourney):**
```
A phone lying face-up on a dark kitchen counter at night, screen glowing with
blank message bubbles, no text visible, cold forensic documentary still,
photorealistic, near-black background, single hard light source, deep shadow,
desaturated grey-blue palette with one cold UI-blue accent, anonymous and
clinical, faint film grain, no text, no logos, 8k --ar 9:16 --style raw
```

### Lane B — Historical (scripts #7, #8)

```
archival period photograph, photorealistic, ultra-detailed, candlelit single
source, deep shadow, aged parchment and ink palette with oxblood and brass
accents, patina and dust, museum object photography, no faces, no text, 8k
```

**Example (Midjourney):**
```
An ornate hand-tinted 1820s map on a dark wooden desk, one coastline outlined
in gold leaf, brass dividers resting across it, archival period photograph,
photorealistic, candlelit single source, deep shadow, aged parchment and ink
palette with oxblood and brass accents, patina and dust, museum object
photography, no faces, no text, 8k --ar 9:16 --style raw
```

**Aspect ratio:** Midjourney `--ar 9:16` · Flux/Leonardo/DALL·E 1080×1920 ·
Runway/Kling/Pika: vertical preset.

**Channel accent colours:** Lane A — UI blue `#3B82F6`, with alert red
`#EF4444` and *poison green* `#22C55E` reserved strictly for fake money and
fake profits. Never use green for anything genuine; it's the channel's tell.
Lane B — brass `#B08D57` on parchment `#EAE0CC`.

---

## 1 — "The wrong number" · *Pig butchering* · Lane A

*On-screen text (UI blue): SORRY, WRONG NUMBER*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | A single blank grey message bubble alone at the top of an empty black phone screen, vast dark space below it, extreme close-up, no text | Dead still; a typing indicator pulses once at the bottom |
| 2 | 3–14s | A long vertical column of blank message bubbles, hundreds of them, receding upward into darkness like a ladder, no text visible | Continuous slow upward scroll — the length is the whole point; never stop it |
| 3 | 14–28s | An abstract trading dashboard on a dark screen, a rising line chart and stacked numeric panels glowing sickly green, softly out of focus, no readable text | Chart line climbs steadily; digits flicker upward |
| 4 | 28–38s | A small banking notification card on a phone screen at night, one short numeric line, utterly mundane, cold blue-white glow on a wooden table | Notification slides in and settles; nothing else moves |
| 5 | 38–50s (payoff + loop) | Wide overhead shot of a long bare desk holding forty identical phones face-up in rows, each screen glowing faintly, one empty chair, no people | Slow pull-back revealing more rows than expected; hold, cut to black |

**Thumbnail prompt:** A single grey message bubble on a pure black phone screen,
enormous empty space below it for text, one cold blue rim of light.

---

## 2 — "Everyone on the call was fake" · *Deepfake fraud* · Lane A

*On-screen text: ALL OF THEM*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | A three-by-three video call grid on a dark monitor, each tile holding a softly blurred anonymous figure, faces indistinct, cold conference-room lighting | Tiles flicker with compression artefacts; one freezes a half-second late |
| 2 | 3–14s | An empty corporate meeting room at night lit only by a large wall screen, one chair pulled out, laptop open on the table, no people | Very slow push-in toward the glowing screen |
| 3 | 14–26s | A single video call tile dissolving from a soft human silhouette into a glowing blue wireframe mesh against black, mid-transition | Mesh resolves and un-resolves, breathing between real and constructed |
| 4 | 26–38s | An abstract bank transfer confirmation panel on a dark screen, large blank numeric field, cold blue interface, no readable text, no logos | A progress bar completes; a tick appears; everything else static |
| 5 | 38–50s (payoff + loop) | The same three-by-three grid, now every tile identical — the same faint grey silhouette repeated nine times, one tile edged in red | Grid holds perfectly still; the red edge pulses once; cut to black |

**Thumbnail prompt:** A 3×3 video call grid where all nine tiles hold the same
grey silhouette, hard red border around the frame, deep black background.

---

## 3 — "The voice was hers" · *AI voice cloning* · Lane A

*On-screen text: IT WASN'T HER*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | A phone lying face-up on a dark kitchen counter at night, screen glowing with a blank incoming-call interface, no text, cold light against warm wood | Screen pulses with an unheard ring; the room stays black |
| 2 | 3–15s | An audio waveform rendered in warm gold slowly hollowing out into a thin synthetic blue wave against pure black, mid-transformation | Waveform morphs continuously from organic and irregular to mechanical and even |
| 3 | 15–28s | A domestic staircase at night seen from the bottom, one warm light on at the top of the landing, everything else in shadow, no people | Absolutely static; only the light flickers faintly |
| 4 | 28–38s | Extreme close-up of a kitchen clock face in near-darkness, second hand mid-sweep, cold blue light raking across it | Second hand ticks; each tick lands hard |
| 5 | 38–50s (payoff + loop) | The same phone on the same counter, screen now completely dark, the room lighter than before, dawn grey at the window | Slow lift of ambient light; the phone stays dead; cut to black |

**Thumbnail prompt:** A phone face-up on a dark counter with a blank glowing
call screen, a soft warm light spilling from a staircase behind it, large clear
space at top for text.

---

## 4 — "The typos are on purpose" · *Scam email design* · Lane A

*On-screen text: ON PURPOSE*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | An empty email window filling the frame, blank white body, plain grey interface chrome, one red circle annotation on an empty line, no text | Static; the red circle draws itself on |
| 2 | 3–16s | Macro shot of a printed page under harsh light with several words circled in red pen, deliberately out of focus so no words are legible, paper texture visible | Slow drift across the page; circles arrive one at a time |
| 3 | 16–32s | A wide flat funnel diagram against near-black, a dense field of tiny grey dots entering the top and only three surviving at the bottom, minimal two-colour infographic | Dots pour in and vanish; the surviving three glow blue |
| 4 | 32–50s (payoff + loop) | The same funnel, now with a heavy red word-stamp shape across it (blank rectangle for overlaid text), stark and diagrammatic | Stamp lands hard on beat; hold; cut to black |

**Thumbnail prompt:** A blank email window with one line circled in thick red
pen, stark white on black, huge empty space above for text.

---

## 5 — "Two cherries and a bar" · *The near-miss* · Lane A

*On-screen text: ALMOST*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | Extreme macro of three slot machine reels behind glass, two cherry symbols aligned and the third reel stopped just barely short, warm casino light, shallow depth of field | The third reel settles a fraction too far and stops dead |
| 2 | 3–16s | A clean anatomical brain diagram on a black background with one deep central region glowing hot, minimal medical-infographic style, cold blue lines and one warm core | The glowing region pulses twice, identically, as if for two different events |
| 3 | 16–32s | A slot machine payout display in near-darkness surrounded by exploding light and celebratory colour, the numeric fields left blank, gaudy and overwhelming | Lights burst outward wildly around a completely static centre |
| 4 | 32–50s (payoff + loop) | A wide, silent casino floor at closing time, long rows of machines still lit, patterned carpet, no people at all | Extremely slow dolly down the aisle; machines blink to nobody; cut to black |

**Thumbnail prompt:** Macro of three slot reels, two matching cherries and the
third stopped a hair short, hard glass reflection, dark surround, space at top
for one large word.

---
## 6 — "The coin with no blockchain" · *OneCoin* · Lane A

*On-screen text: NO BLOCKCHAIN*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | A heavy gold coin floating in pure black, ornate blank face with no markings, dramatic rim light, luxurious and weighty | Coin rotates slowly; the blank face turns toward camera |
| 2 | 3–16s | The same gold coin dissolving into a flat empty spreadsheet grid, half metal and half grey cells, mid-transition against black | Metal texture erodes cell by cell into flat grey |
| 3 | 16–32s | A vast arena crowd rendered entirely as silhouettes under a single beam of stage light, thousands of raised hands, faces invisible | Light sweeps across the crowd; the crowd surges once |
| 4 | 32–50s (payoff + loop) | A blockchain diagram of linked cubes receding into darkness, every cube completely hollow and empty, cold blue wireframe on black | Camera travels along the empty chain; it never ends; cut to black |

**Thumbnail prompt:** A cracked-open gold coin revealing an empty grey
spreadsheet cell inside, black background, hard rim light, space above for text.

---

## 7 — "Sold the Eiffel Tower" · *Victor Lustig, 1925* · Lane B

*On-screen text (brass): TWICE*

> **No likenesses.** Lustig and the buyer are both real historical people. Use
> objects, rooms and light only — never a generated portrait, never their names
> in a prompt.

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | The Eiffel Tower seen through heavy 1920s fog as a flat cold grey silhouette, wet cobbles below, no people, muted period photograph | Fog drifts; the tower never fully resolves |
| 2 | 3–15s | Macro of embossed government letterhead on heavy cream paper under candlelight, raised seal catching the light, text deliberately out of focus and illegible | Slow rake of light across the embossing |
| 3 | 15–28s | A 1920s hotel suite interior, six identical bowler hats on a mahogany hat stand, six empty chairs around a table, cigar smoke hanging in lamplight, no people | Smoke curls; the room is otherwise abandoned |
| 4 | 28–40s | Two hands shaking across a dark table lit by a single lamp, sleeves of 1920s suits, faces entirely out of frame, an envelope beside them | Handshake holds a beat too long; the envelope stays untouched |
| 5 | 40–50s (payoff + loop) | An empty 1920s police station front desk at night, ledger open to a blank page, brass lamp, no one on either side of the counter | Static; dust in the lamplight; cut to black |

**Thumbnail prompt:** The Eiffel Tower in fog with a heavy aged paper tag tied
to its base, brass and parchment tones, blank tag face for overlaid text.

---

## 8 — "He invented a country" · *Poyais, 1820s* · Lane B

*On-screen text: POYAIS*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | An ornate hand-tinted 1820s map on dark wood, one coastline outlined in gold leaf, brass dividers resting across it, candlelight, place names illegible | Slow push-in toward the gold coastline |
| 2 | 3–15s | Macro of an ornate engraved 19th-century banknote, elaborate scrollwork and a blank central cartouche, aged paper fibres visible, no legible text | Light rakes across the engraving; paper fibres catch |
| 3 | 15–28s | An open leather-bound guidebook under lamplight, an engraved illustration of a grand colonial harbour city on the page, text illegible | Page edges lift slightly; the illustration holds the frame |
| 4 | 28–40s | The same coastline in reality — flat grey sea, dense low jungle, empty mudflat shore under overcast sky, no structures, no people, cold and modern-looking | Static wide; only the water moves; the emptiness does the work |
| 5 | 40–50s (payoff + loop) | A ship's wooden rail from behind, rope coiled, grey open sea beyond, no one at the rail, muted archival tones | Very slow rise and fall of the horizon; cut to black |

**Thumbnail prompt:** An ornate antique map with one coastline outlined in gold,
brass dividers across it, deep shadow, large parchment space for text.

---

## 9 — "The call that warns you" · *Bank impersonation* · Lane A

*On-screen text: "YOUR ACCOUNT IS AT RISK"*

> **Fictional bank only.** Name it `NORTHBANK` or `MERIDIAN TRUST` in the
> overlay. Never generate or overlay a real institution's name or logo.

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | A phone screen showing a blank incoming-call interface in a dark room, generic bank-style icon, no text, cold blue glow on a person's out-of-focus shoulder | Screen pulses with the ring; the figure behind stays motionless |
| 2 | 3–15s | An abstract mobile banking app mid-transfer, large blank numeric fields, cold blue interface, deliberately generic and non-photoreal, no logos, no readable text | A slow progress spinner turns; nothing completes |
| 3 | 15–28s | A pair of elderly hands holding a phone in warm lamplight, face entirely out of frame, a cup of tea going cold on the table beside them | Almost no movement; one thumb hovers, then commits |
| 4 | 28–40s | A cheap headset resting on a bare desk under a hard fluorescent strip, blank monitor behind, grey partition wall, utterly anonymous | Static; the fluorescent flickers once |
| 5 | 40–50s (payoff + loop) | The same banking screen, transfer complete, one large blank field where a balance would be, cold blue on black, the room behind now dark | Screen dims to standby; cut to black |

**Thumbnail prompt:** A phone showing a blank incoming-call screen with a
generic bank icon, a small cracked red padlock beside it, dark room, space at
top for text.

---

## 10 — "Why gift cards" · *The payment tell* · Lane A

*On-screen text: WHY GIFT CARDS?*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–3s (hook) | A supermarket gift card rack shot straight on under hard fluorescent light, dozens of blank unbranded plastic cards in rows, saturated primary colours, no text, no logos | Static and symmetrical; one card is slightly out of line |
| 2 | 3–16s | Extreme macro of the back of a plain plastic card, silver scratch-off strip partly rubbed away, fingerprint smudges, harsh raking light | Slow drift along the strip; silver dust visible |
| 3 | 16–32s | A minimal two-colour flow diagram against near-black: one path marked in red looping back on itself, one path in green running off the edge of the frame and ending in nothing | Red path animates in and returns; green path shoots off and simply stops |
| 4 | 32–50s (payoff + loop) | A single blank plastic card held between two fingers against a black background, hard side light, obviously weightless and cheap | Card tilts once, catching the light; cut to black |

**Thumbnail prompt:** A wall of blank colourful gift cards with one pulled
forward and lit hard, deep black surround, clear space at top for a question.

---

## Reusable assets — build these once

Four generations serve all ten videos and most of the back catalogue. Make
these first, save them, and stop regenerating them.

| Asset | Prompt | Used in |
|---|---|---|
| **The phone frame** | A modern phone held slightly off-axis in a dark room, screen blank and glowing cold blue-white, no interface, no text, deep shadow behind, hard side light | #1, #3, #9 — and every phone-scam script you will ever write |
| **The anonymous desk** | A bare desk under a hard fluorescent strip, cheap headset, blank monitor, grey partition wall, no people, no personal objects, institutional and empty | #1, #9, plus the whole phone-scam series |
| **The funnel / flow plate** | A minimal flat infographic on near-black, thick two-colour strokes, a wide funnel narrowing to a single point, no text, generous empty space | #4, #5, #6, #10 — and the entire Ponzi and dark-patterns series |
| **The two title cards** | Lane A: near-black field, one cold blue horizontal rule, heavy empty space. Lane B: aged parchment field, one brass rule, deckled paper edge | Every video — the viewer should know the series before you speak |

---

## Generation and cost notes

**Cheapest first.** #4 and #10 are 4 shots each and mostly diagram or product
photography — no scene generation, no period work. Make those two first as your
format test. If the look works there, it works everywhere.

**Batch by lane, not by video.** Generate all Lane B shots for #7 and #8 in one
sitting. Period lighting and grade drift badly between sessions, and those two
scripts will sit next to each other in the series.

**46 shots, roughly 140–185 generations** at 3–4 variations each. Two paid
sessions on any major generator. The four reusable assets above cut the next
ten videos to roughly half that.

**Motion is optional.** Every shot here reads as a still with a slow push-in or
pull-back added in the editor. Only four shots genuinely benefit from a video
generator: #1 shot 2 (the endless scroll), #2 shot 3 (the wireframe dissolve),
#3 shot 2 (the waveform hollowing), and #6 shot 2 (the coin eroding). Spend
video credits there and nowhere else.

**The camera vocabulary is three moves.** Slow push-in on a reveal, slow
pull-back on a scale reveal, hard cut on the twist. Anything else — whips,
shakes, zooms — makes this material look like the content it's critiquing.

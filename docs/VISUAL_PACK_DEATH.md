# Death What-Ifs — Visual Pack

Shot-by-shot AI image/video prompts for all 5 scripts in
[`SCRIPT_PACK_DEATH.md`](SCRIPT_PACK_DEATH.md). Copy a prompt, append the
**master style suffix**, add your 9:16 flag, and generate. Every shot lists its
edit timing and a motion note for video generators (Runway / Kling / Pika / Veo).

> Generate 3–4 variations per shot and keep the *quietest* one. Cut every
> 1.5–3 seconds. Shot 1 doubles as your thumbnail unless a dedicated thumbnail
> prompt is listed.

---

## The restraint rule (read this before you generate anything)

**No bodies. No gore. No medical distress. No real people's faces.**

This is not squeamishness — it's the craft *and* the business case:

- **Absence is stronger than depiction.** An empty armchair with the light going
  out of the room lands harder than any corpse, because the viewer's own mind
  fills it. This whole niche works on implication.
- **Gore gets you age-restricted and demonetized.** Graphic medical or death
  imagery trips YouTube's advertiser-friendly guidelines and can age-gate a
  Short into oblivion. Restraint keeps the reach.
- **Image generators refuse death prompts.** Prompt *objects, spaces, and light*
  instead of the death itself — "an empty hospital bed at dawn," never "a dead
  body." Everything below is written that way, so it generates cleanly on the
  first pass.
- **Never generate a likeness of a real person.** Script 3 is about Anna
  Bågenholm, who is alive and working today. Her shots are framed from behind,
  face never visible, and are explicitly anonymous. Do not prompt her name.

---

## The master style suffix (append to every image prompt)

```
cinematic memento mori documentary, photorealistic, ultra-detailed, low-key
lighting, single soft light source, deep shadow, desaturated cold palette with
one pale monitor-cyan accent, subtle film grain, quiet stillness, reverent
restrained mood, 8k, dark documentary aesthetic
```

**Example (Midjourney):**
```
An EEG monitor glowing in a dark empty hospital room, a single cyan waveform
scrolling across black, reflection in the window glass, cinematic memento mori
documentary, photorealistic, low-key lighting, deep shadow, desaturated cold
palette with one pale monitor-cyan accent, subtle film grain, quiet stillness,
reverent restrained mood, 8k --ar 9:16 --style raw
```

**Aspect ratio:** Midjourney `--ar 9:16` · Flux/Leonardo/DALL·E 1080×1920 ·
Runway/Kling/Pika: vertical preset.

**Channel accent color:** monitor cyan (#7FE3E0) — one cold light in a dark,
desaturated world. Use it for on-screen text so the type reads as part of the
instrumentation. (Deliberately opposite the Extreme Weather channel's ember
orange — each niche gets its own identity.)

---

## 1 — "The 900 seconds" · *The dying brain*

*On-screen text (monitor cyan): 900 SECONDS*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–2s (hook) | An EEG monitor glowing in a dark, empty hospital room, a single cyan waveform scrolling across a black screen, faint reflection in the window glass behind it | Waveform scrolls steadily right-to-left; everything else dead still |
| 2 | 2–7s | A hospital room at night lit by one small lamp, empty visitor's chair pulled close to a neatly made bed, blanket folded at the foot | Almost static — a slow, nearly imperceptible push-in; dust drifting in the lamplight |
| 3 | 7–18s | A glowing cyan brainwave fracturing into dozens of scattered old photographs suspended in dark space, each one out of focus, drifting apart | Waveform blooms outward, photographs tumble slowly through the frame |
| 4 | 18–30s (payoff + loop) | A single cyan line flattening across a black monitor, the last peak fading behind it, deep shadow filling the rest of the frame | Line flattens, holds three beats, screen dims to black |

**Thumbnail prompt:** A cyan EEG waveform against pure black, mid-scroll, with
one bright spike far larger than the rest — vast negative space above for text.

---

## 2 — "The last sense to go" · *The biology of dying*

*On-screen text: THEY CAN STILL HEAR YOU*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–2s (hook) | Extreme close-up of two hands held together at the edge of a bed, soft grey window light, shallow depth of field, faces out of frame | Barely any motion — a slight tightening of the grip; hold the frame sharp |
| 2 | 2–7s | Concentric rings of soft pale light travelling through dark air toward a silhouetted ear, sound rendered as faint luminous waves | Rings pulse inward rhythmically, like slow speech |
| 3 | 7–18s | A clinical EEG readout on a dark screen showing faint rhythmic response spikes rising above a flat baseline, pale cyan on black | Small spikes appear in time with an unheard voice |
| 4 | 18–30s (payoff + loop) | Wide shot of a dim hospice room from the doorway, one person seated at the bedside mid-sentence, late afternoon light through half-closed blinds | Very slow dolly in from the doorway; fade to black mid-sentence |

**Thumbnail prompt:** A silhouetted ear with soft cyan sound-rings arriving from
darkness, near-black frame, large clear space at the top for text.

---

## 3 — "Not dead until warm and dead" · *The line between alive and dead*

*On-screen text: 13.7°C*

> **Anonymity note:** the subject is a real living person. Frame from behind,
> face never visible. Do not use her name in any prompt.

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–2s (hook) | Aerial view of a frozen mountain stream in Norway, a jagged dark break in the white ice, pine shadows across the snow, no people | Slow aerial drift over the break; the dark water is the only movement |
| 2 | 2–7s | A medical temperature readout in a cold operating room dropping past 13.7 degrees Celsius, frost crystals on the metal housing beside it | Digits tick downward; frost creeps across the housing |
| 3 | 7–18s | A cardiopulmonary bypass circuit in a dim operating theatre, warm red blood running through clear tubing against cold steel and blue drapes | Blood flows steadily through the loop; monitors pulse cyan in the background |
| 4 | 18–30s (payoff + loop) | A woman in a white coat walking away down a bright hospital corridor, seen from behind, face not visible, window light flooding the far end | She walks toward the light; camera holds still; cut to black |

**Thumbnail prompt:** A dark jagged break in white ice seen from directly above,
one small object at the edge, "13.7°C" space cleared in the snow field.

---

## 4 — "The last clear hour" · *Deathbed phenomena*

*On-screen text: TERMINAL LUCIDITY*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–2s (hook) | An empty armchair by a care-home window in late afternoon, a shaft of amber light across it, dust suspended in the beam, knitted blanket over one arm | Dust drifts in the light; the chair never moves |
| 2 | 2–7s | A brain scan on a dark viewer showing large hollow atrophied regions, pale cyan structures against black, clinical and quiet | Scan slices advance slowly through the volume |
| 3 | 7–18s | The same armchair now occupied, warm lamp light, expressive hands mid-gesture in conversation, face softly out of focus | Hands gesture animatedly; the rest of the frame is still and warm |
| 4 | 18–30s (payoff + loop) | The same room as the light drains out of it, chair empty again, lamp off, blue dusk through the window | Light fades across the frame in real time; slow push-in; cut to black |

**Thumbnail prompt:** A single empty armchair in a dark room with one amber shaft
of light falling across it, heavy shadow above for text.

---

## 5 — "The coffins with bells" · *Death rituals & customs*

*On-screen text: SAFETY COFFINS*

| # | Timing | Image prompt | Motion note |
|---|--------|--------------|-------------|
| 1 | 0–2s (hook) | A 19th-century patent drawing of a safety coffin with a bell, cord and breathing tube, aged yellowed paper, precise ink linework, annotations in faded copperplate | Slow pan across the drawing; paper grain visible |
| 2 | 2–7s | A candlelit Victorian waiting mortuary, long rows of sheet-covered forms on stone slabs, thin strings running from each toward a rack of small brass bells on the far wall | Candle flames flicker; strings sway almost imperceptibly |
| 3 | 7–18s | Extreme close-up of a single tarnished brass bell hanging motionless on a hook, dust settling through candlelight, deep black background | Absolutely still; only dust moves. Hold longer than feels comfortable |
| 4 | 18–30s (payoff + loop) | A foggy Victorian graveyard at first light, weathered headstones in rows, one iron bell post standing among them, wet grass | Fog drifts between stones; slow push-in on the bell post; cut to black |

**Thumbnail prompt:** A single tarnished brass bell on a cord against pure black,
lit by one candle, huge negative space to the right for text.

---

## Batch workflow

1. Generate all 20 prompts in one sitting (3–4 variations each) so the look stays
   consistent — same suffix, same session, same model version.
2. Animate only the hooks and payoffs. This niche is *built* for stills with a
   slow push-in; stillness is the tone, not a shortcut.
3. Keep every clip 1.5–3s, and let the final shot of each script run a beat
   longer than feels right before cutting to black.
4. **First frame rule:** Shot 1 must read at phone-lockscreen size in 0.3
   seconds. If it doesn't, regenerate — don't fix it with text.
5. If a generator refuses a prompt, you've drifted toward depiction. Move back
   toward the object, the room, or the light.

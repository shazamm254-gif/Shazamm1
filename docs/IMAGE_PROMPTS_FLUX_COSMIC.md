# Flux-tuned image prompts — Cosmic Dread

The prompts in `PRODUCTION-PACK.md` were written for Midjourney. These are the
Flux versions (`evalstate/flux1_schnell`, 768x1344, 4 steps — free).

**The one rule that matters:** never lead with the darkness. Flux reads
"pure black filling the frame" literally and returns a black rectangle — that
happened on the first scam-niche attempt. Name the light source and make it
the subject; the blackness takes care of itself.

Five prompts were rewritten for exactly that reason: 1.3, 1.4, 4.1, 4.4 and 8.1.

## Master style suffix

```
cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

Cosmic imagery is the ideal case for this pipeline — no text, no faces, no
likeness risk, and one glow accent per shot (amber for black holes and dying
suns, violet/teal for nebulae) against `#05060A` near-black.

---

## Generated: Short #1 (2026-09-21)

All four rendered **first try, no iteration** — the whole argument for this
niche in one run. Yesterday's scam-niche opener took four attempts and still
came back with garbled UI text.

| Shot | Seed | What it is |
|---|---|---|
| 1 | `356237554` | Drift toward the accretion disk — molten orange ring on black |
| 2 | `1995309685` | Silhouette with light streaming off it, stretching into a thread |
| 3 | `540643467` | The full ring around the dark sphere, star field bent into arcs |
| 4 | `577506513` | Dark sphere, one thin crescent of orange along the edge — the loop |

Shots 3 and 4 are two of the five rewritten prompts. Under the original
Midjourney wording ("glowing ring around absolute black", "pure black filling
the frame") both would have returned empty rectangles.

Settings: `evalstate/flux1_schnell`, 768x1344, 4 steps, seeds above.

### Motion clips (Wan 2.2, free)

All four stills animated via `zerogpu-aoti/wan2-2-fp8da-aoti-faster`,
`duration_seconds: 4`, `steps: 6`, at zero credits.

| Shot | Clip seed | Motion asked for |
|---|---|---|
| 1 | `964384035` | Disk rotating, gas streaming, slow push into the centre |
| 2 | `583065181` | Silhouette elongating downward, light threads flowing up |
| 3 | `748985217` | Ring rotating around the sphere, bent star field shimmering |
| 4 | `1851443852` | Crescent narrowing and dimming — patient fade to black |

**Timing mismatch to fix in the edit.** The voiceover is 25.5s and four 4s clips
total 16s. Either slow each clip to ~0.62x (6.4s per shot — fine for motion this
slow, and free), or regenerate with `duration_seconds: 7`, which costs more
quota. Setting the duration to match the VO up front is the better habit.

---

## 1 — Falling Into a Black Hole · *Space Horror*

**Hook:** This is what happens if you fall into a black hole.

**On-screen:** `INTO THE BLACK`

**Voiceover:**

> This is what happens if you fall into a black hole. To anyone watching, you slow down — and freeze at the edge, forever. To you, gravity pulls your feet harder than your head, and stretches your body into a thread. They call it spaghettification. You never hit a surface. You just become part of the dark.

**End line:** …and from outside, you're still falling." *(loops to the hook)

**Title:** What happens if you fall into a black hole

**Description:** Time freezes, gravity stretches you into a thread. This is spaghettification. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #blackhole #shorts #cosmichorror

**Shot 1**
```
A slow drift toward a black hole's glowing orange accretion disk, light bending around it, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
A human silhouette stretching into a thin thread of light falling toward the dark, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
A brilliant glowing orange accretion ring of superheated gas curving all the way around a small dark sphere at its centre, the star field behind it visibly bent and smeared into bright arcs, the ring is the brightest thing in frame, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
A vast dark sphere filling most of the frame with one thin brilliant crescent of warm orange light burning along its outer edge, the crescent sharp and clearly visible, everything else falling away, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

## 2 — The Largest Thing in the Universe · *Cosmic Giants*

**Hook:** This is the largest thing in the entire universe.

**On-screen:** `10 BILLION LIGHT-YEARS WIDE`

**Voiceover:**

> This is the largest thing in the entire universe. The Hercules–Corona Borealis Great Wall — a chain of galaxies ten billion light-years across. It's so vast that light, the fastest thing there is, can't cross it in the entire age of the cosmos. Next to it, our whole galaxy is a single grain of sand.

**End line:** And we still don't know how it formed.

**Title:** The largest thing in the universe is unimaginable

**Description:** 10 billion light-years wide — light can't even cross it. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #galaxy #shorts #spacefacts

**Shot 1**
```
Earth as a small blue dot against the black, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
A slow zoom out from the solar system to the spiral of the Milky Way, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
A vast glowing web of galaxies stretching across the entire frame, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
A tiny labeled dot in a vast cosmic web with everything else dwarfing it, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

## 3 — If the Sun Vanished · *What If*

**Hook:** What if the Sun vanished right now?

**On-screen:** `8 MINUTES OF LIGHT`

**Voiceover:**

> What if the Sun vanished right now? For eight minutes, you'd notice nothing — the light reaching you already left it. Then darkness. Then the Earth, with nothing to hold it, flies off in a straight line into deep space. Within weeks, the oceans freeze. Within a year, the air itself.

**End line:** Look up. That light is already eight minutes old.

**Title:** What if the Sun disappeared right now?

**Description:** 8 minutes of warning, then Earth flies into the dark. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #shorts #spacefacts #physics

**Shot 1**
```
The Sun blinking out, the frame falling into darkness, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
A dark Earth drifting off its orbit in a straight line into deep space, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
Frozen oceans, cracked ice stretching to a black horizon, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
A frost-covered dead city under a starlit black sky, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

## 4 — The Last Star · *The End*

**Hook:** This is the last star that will ever shine.

**On-screen:** `+100 TRILLION YEARS`

**Voiceover:**

> This is the last star that will ever shine. In a hundred trillion years, the universe runs out of the gas that makes stars. The final red dwarf flickers, fades — and goes out. After that, there is no light anywhere. Just cold, black, empty space, forever. Nothing else ever happens.

**End line:** We're living in the universe's brief, bright morning.

**Title:** The last star that will ever shine

**Description:** In 100 trillion years, the lights go out for good. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #shorts #cosmichorror #physics

**Shot 1**
```
A single small deep-red dwarf star glowing clearly at the centre of an empty starless expanse, its red light casting a faint halo into the dark, the star small but distinctly bright, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
The red star dimming further, its glow shrinking, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
The star flickering out, the frame going fully dark, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
An almost featureless dark expanse with a barely perceptible deep indigo gradient across it and a few extremely faint distant points of light, vast emptiness rendered as subtle tonal variation rather than flat black, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

## 5 — When Black Holes Collide · *Cosmic Giants*

**Hook:** When two black holes collide, the whole universe shakes.

**On-screen:** `THE UNIVERSE SHOOK`

**Voiceover:**

> When two black holes collide, the whole universe shakes. The crash sends ripples through space and time itself — gravitational waves. By the time they reached Earth, a billion years later, they stretched every atom on the planet by less than the width of a proton. We finally felt it in 2015.

**End line:** It happened a billion years ago. We're just now hearing it.

**Title:** When two black holes collide, the universe shakes

**Description:** Gravitational waves stretched every atom on Earth. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #blackhole #shorts #physics

**Shot 1**
```
Two black holes spiraling toward each other, accretion disks tilted and glowing, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
A blinding flash at the moment two black holes merge at the center of warped space, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
Rings of gravitational waves rippling outward through a glowing space-time grid, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
A faint wave washing over a tiny distant blue Earth, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

## 6 — Planets With No Sun · *Space Horror*

**Hook:** There are planets drifting in the dark with no sun at all.

**On-screen:** `ROGUE PLANETS`

**Voiceover:**

> There are planets drifting in the dark with no sun at all. Rogue planets — flung out of their solar systems, wandering between the stars, frozen and alone. There may be billions of them, more than there are stars. One could drift through our system and fling Earth out of orbit. And we'd never see it coming.

**End line:** It would already be too late.

**Title:** There are planets with no sun, drifting in the dark

**Description:** Billions of frozen rogue planets wander between the stars. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #shorts #cosmichorror #scifi

**Shot 1**
```
A dark frozen rogue planet drifting through starless black, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
A rogue planet passing a distant sun, its surface still unlit, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
A dark rogue planet nearing a small blue Earth, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
Earth nudged off its orbit, drifting into the dark, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

## 7 — The Monster at the Center · *Cosmic Giants*

**Hook:** There's a monster at the center of our galaxy.

**On-screen:** `SAGITTARIUS A`

**Voiceover:**

> There's a monster at the center of our galaxy. Sagittarius A* — a black hole four million times the mass of the Sun. Every star in the Milky Way, including ours, is slowly orbiting it. Including you. Right now you are circling a black hole at half a million miles an hour, and you can't feel a thing.

**End line:** You've been orbiting it your whole life.

**Title:** There's a monster at the center of our galaxy

**Description:** A black hole 4 million times the Sun's mass — and you orbit it. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #blackhole #shorts #galaxy

**Shot 1**
```
Flying down through the glowing spiral arms of the Milky Way, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
Stars whipping in fast orbits around a dark central point, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
The silhouette of the central black hole Sagittarius A star, a perfect dark sphere, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
A tiny dot, the Sun, tracing its slow orbit far out from the galactic center, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

## 8 — The Loneliest Place · *Space Horror*

**Hook:** This is the loneliest place in the known universe.

**On-screen:** `330 MILLION LIGHT-YEARS OF NOTHING`

**Voiceover:**

> This is the loneliest place in the known universe. The Boötes Void — a bubble of almost-nothing, 330 million light-years across, with barely a galaxy inside it. If our Milky Way sat at its center, we wouldn't have discovered other galaxies existed until the 1960s. We'd have thought we were utterly alone.

**End line:** Imagine looking up and seeing nothing at all.

**Title:** The loneliest place in the universe is empty

**Description:** 330 million light-years of almost pure nothing. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #void #shorts #cosmichorror

**Shot 1**
```
A dense bright cluster of spiral galaxies glowing small in one corner of the frame, surrounded by an immense dark empty void, the galaxies luminous and detailed against the darkness, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
A single faint galaxy drifting alone in an enormous void, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
Endless dark, almost no light anywhere in the frame, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
A lone galaxy as a tiny smudge surrounded by total emptiness, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

## 9 — The Deadliest Event · *The End*

**Hook:** This is the deadliest event in the entire universe.

**On-screen:** `GAMMA-RAY BURST`

**Voiceover:**

> This is the deadliest event in the entire universe. A gamma-ray burst — in just seconds, it releases more energy than the Sun will in its whole ten-billion-year life. If one fired at Earth from a few thousand light-years away, it would strip our atmosphere and end nearly all life on the planet. And we would get no warning at all.

**End line:** One may already be on its way.

**Title:** The deadliest event in the universe gives no warning

**Description:** More energy in seconds than the Sun makes in 10 billion years. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #shorts #cosmichorror #physics

**Shot 1**
```
A collapsing star, its core imploding in its final instant, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
Twin beams of intense light firing out from a star's poles, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
A beam of radiation sweeping across space toward a tiny blue Earth, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
Earth's atmosphere flaring and being stripped away by a radiation beam, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

## 10 — The Great Attractor · *Unexplained*

**Hook:** Something is pulling our galaxy toward it — and we can't see what.

**On-screen:** `THE GREAT ATTRACTOR`

**Voiceover:**

> Something is pulling our entire galaxy toward it at over a million miles an hour — and we can't see what it is. We call it the Great Attractor. It sits hidden behind the bright core of the Milky Way, dragging thousands of galaxies, including ours, toward a single point. We are being pulled. We don't fully know to what.

**End line:** We've been falling toward it the whole time.

**Title:** Something is pulling our galaxy — we can't see what

**Description:** The Great Attractor drags thousands of galaxies toward the unknown. Subscribe for more cosmic dread. #space #universe #cosmos #astronomy #shorts #cosmichorror #scifi

**Shot 1**
```
Thousands of galaxies streaming in one direction across the frame, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 2**
```
An unseen mass hidden behind the bright glare of the Milky Way's core, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 3**
```
A dark mysterious region with galaxies bending toward it, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

**Shot 4**
```
Galaxies still flowing inward toward an unknown point in the dark, cinematic deep space photography, photorealistic, ultra detailed, volumetric light, luminous highlights against rich black, awe-inducing scale, ominous, fine film grain
```

---

# Cosmic Style Guide — make every clip look like one channel

The prompts in this pack describe *what's in the shot*. This file describes *how
it looks* — the consistent style you append to every prompt so your whole channel
shares one cinematic identity. **This consistency is your brand.**

---

## The master style suffix (append to every image prompt)

```
cinematic cosmic horror, photorealistic deep space, ultra-detailed, volumetric
light, single dramatic light source, deep blacks, subtle film grain, awe-inducing
scale, ominous mood, 8k, highly detailed, dark sci-fi documentary aesthetic
```

Paste your chosen prompt, then this suffix, then your aspect-ratio flag.

**Example (Midjourney):**
```
A supermassive black hole with a glowing orange accretion disk warping the
starlight around it, cinematic cosmic horror, photorealistic deep space,
ultra-detailed, volumetric light, single dramatic light source, deep blacks,
subtle film grain, awe-inducing scale, ominous mood, 8k, dark sci-fi
documentary aesthetic --ar 9:16 --style raw
```

---

## Aspect ratio (Shorts = vertical 9:16)

| Tool | Flag / setting |
|---|---|
| Midjourney | `--ar 9:16` |
| Flux / Leonardo / DALL·E | set output to 1080×1920 (9:16) |
| Runway / Kling / Pika | choose the 9:16 / vertical preset |

Generate vertical from the start — cropping a 16:9 image loses your subject.

---

## Palette

- **Base:** near-black and deep space blue (`#05060A`, `#0A1024`).
- **One accent per shot:** pick a single glow color and let it dominate —
  - Orange/amber → black holes, accretion disks, dying suns
  - Icy blue/white → neutron stars, frozen worlds, distant stars
  - Deep red → supernovae, gamma-ray bursts, danger
  - Violet/teal → nebulae, exotic/unexplained objects
- **Rule:** one dominant light source, everything else falling into black. High
  contrast reads at thumbnail size and feels ominous.

---

## Negative prompt (append where your tool supports it)

```
text, watermark, signature, logo, UI, people, faces, astronauts, cartoon,
illustration, flat lighting, oversaturated, cluttered, busy background,
low detail, blurry, lens flare overload, rainbow colors
```

(Midjourney: use `--no text, people, watermark, cartoon, oversaturated`.)

---

## Five rules that keep it on-brand

1. **One subject, large in frame.** A single object against the void beats a busy scene.
2. **One light source.** Glow from the subject; everything else goes black.
3. **Same suffix every time.** Don't improvise the style per clip.
4. **Vertical, always.** 9:16 from generation, not by cropping.
5. **Awe over pretty.** If you have to choose, pick the more *unsettling* image —
   it stops the scroll.

---

## Optional style variants (for series differentiation)

Keep the master suffix, then add one tag so each series has a subtle signature:

- **Space Horror:** `+ unsettling, eerie, high contrast, threatening`
- **Cosmic Giants:** `+ epic scale, vast, monumental, sense of immensity`
- **The End:** `+ cold, desolate, fading light, entropy, emptiness`
- **What If:** `+ dramatic, speculative, dynamic motion`
- **Unexplained:** `+ mysterious, otherworldly, strange glow`

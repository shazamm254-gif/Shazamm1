"""
Shared machinery for the hand-written script modules in this package.

Each sheet gets its own module (scam_mechanics.py, gym_rats.py,
trick_design.py). They all import from here, call register(), and the
package __init__ collects everything into MANUAL_SCRIPTS.

FACT-CHECK POLICY (applies to every script in this package):
  - No invented statistics. If a real figure would strengthen a line, the
    script describes the mechanism instead and leaves the number out.
  - Nothing sourced from research with known replication or data-integrity
    problems. Several classic retail-psychology results (notably the
    "limit N per customer" and portion-size work associated with retracted
    Cornell food-lab research) are deliberately written mechanism-first,
    with no study cited and no effect size claimed.
  - Where a specific person or company is named, the claim is limited to
    what is publicly documented and self-reported by them.
  If you add figures before recording, verify each against the primary
  source. Do not let a plausible-sounding draft number become narration.
"""

from ..script_builder import Beat, ImagePrompt, Script, slugify

MANUAL_SCRIPTS = {}

# Standard negative prompt.
NEG = "no visible face, no text, no watermark, no logos"

# Stricter guard for sheets that name real chains in narration: never render
# identifiable branding or trade dress.
NEG_BRAND = "no text, no watermark, no logos, no brand names, no recognizable trade dress"

# --- Category palettes ------------------------------------------------------
# Category-level rather than per-idea, so a whole channel reads as one visual
# system instead of 50 unrelated looks. Each is drawn from the palette column
# of the corresponding content-system sheet rows.

P_SUPERMARKET = "Blueprint blue, warm retail amber, cart-metal grey, alert-red accent"
P_RETAIL = "Blueprint blue, retail amber, floor-tile white, alert-red path line"
P_CASINO = "Casino-carpet burgundy, neon accent, near-black, warm slot-glow gold"
P_RESTAURANT = "Menu cream, ink black, candle amber, linen white, alert-red accent"
P_ATTRACTION = "Theme-park teal, queue-rail grey, sign gold, path red"
P_PRICING = "Sale-tag red, price-sticker white, ink black, retail amber"
P_PERCEPTION = "Lobby brass, mirror silver, marble cream, wayfinding blue"
P_URBAN = "Concrete grey, municipal green, steel silver, caution-amber accent"
P_AIRPORT = "Terminal grey, duty-free gold, wayfinding yellow, path red"
P_SENSORY = "Warm gold, duct-metal grey, waveform blue, cream"
P_MALL = "Mall-tile cream, skylight white, storefront neon accent, wayfinding blue"


def img(description, motion, palette, negative=NEG_BRAND):
    """One shot: a description, its camera move, and the palette to render in."""
    return (f"{description}, {palette}, clean technical illustration, {negative}.", motion)


def thumb(description, palette, negative=NEG_BRAND):
    return (f"{description}, {palette}, high-contrast, single clear focal point, "
            f"dramatic lighting, {negative}.")


def make_script(rank, title, lines, image_prompts, thumbnail_prompt):
    beats = [Beat(caption=line, words=len(line.split())) for line in lines]
    prompts = [
        ImagePrompt(prompt=prompt, weight=beat.words, motion=motion)
        for beat, (prompt, motion) in zip(beats, image_prompts)
    ]
    return Script(
        rank=rank,
        title=title,
        slug=slugify(title),
        full_text=" ".join(lines),
        beats=beats,
        image_prompts=prompts,
        thumbnail_prompt=thumbnail_prompt,
    )


def register(rank, title, lines, images, thumbnail_prompt):
    """
    Register one hand-written script, keyed by title slug.

    Keyed by slug and NOT by rank: each content-system sheet has its own
    rank 1, rank 2, and so on, so rank-keying would let one sheet's override
    silently clobber another's.
    """
    if len(lines) != len(images):
        raise ValueError(
            f"{title!r}: {len(lines)} narration lines but {len(images)} image prompts -- "
            f"they must pair one-to-one."
        )
    script = make_script(rank, title, lines, images, thumbnail_prompt)
    if script.slug in MANUAL_SCRIPTS:
        raise ValueError(f"duplicate override slug {script.slug!r} (from {title!r})")
    MANUAL_SCRIPTS[script.slug] = script
    return script

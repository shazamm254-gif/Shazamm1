"""
Turns one row of a content-system spreadsheet into a Script: full narration
text plus a list of image prompts with time weights.

This is deliberately template-based, not LLM-based -- it works with zero
API keys, using the rich fields the strategy sheet already has (Hook,
Curiosity Gap, Why Watch to End, Twist). It's a solid first draft, not a
finished script; treat it as the thing you proofread/tweak before a real
render, or swap in an LLM call here if you want it fully hands-off.

Ideas worth extra care get a hand-written script in overrides.py instead --
build_script() checks there first.
"""

import re
import unicodedata
from dataclasses import dataclass

TITLE_COL = 2
CATEGORY_COL = 3
HOOK_COL = 4
GAP_COL = 5
WHY_END_COL = 6
VISUALS_NEEDED_COL = 12
VISUAL_STYLE_COL = 13
PALETTE_COL = 14
THUMB_COL = 15
TWIST_COL = 18

SHOT_VARIANTS = [
    "wide establishing shot",
    "close-up detail shot",
    "overhead diagram angle",
    "slow push-in shot",
    "side-lit dramatic angle",
    "macro detail insert",
]

WORDS_PER_SECOND = 2.5  # ~150 wpm narration pace


@dataclass
class Beat:
    caption: str
    words: int


@dataclass
class ImagePrompt:
    prompt: str
    weight: float  # relative share of total duration
    motion: str = "push_in"  # see pipeline/assemble.py


@dataclass
class Script:
    rank: int
    title: str
    slug: str
    full_text: str
    beats: list
    image_prompts: list
    thumbnail_prompt: str


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return text[:60]


def read_row(ws, row):
    def cell(col):
        v = ws.cell(row, col).value
        return v.strip() if isinstance(v, str) else v

    return {
        "rank": int(ws.cell(row, 1).value),
        "title": cell(TITLE_COL),
        "category": cell(CATEGORY_COL) or "",
        "hook": cell(HOOK_COL) or "",
        "gap": cell(GAP_COL) or "",
        "why_end": cell(WHY_END_COL) or "",
        "visuals_needed": cell(VISUALS_NEEDED_COL) or "5",
        "visual_style": cell(VISUAL_STYLE_COL) or "",
        "palette": cell(PALETTE_COL) or "",
        "thumb_concept": cell(THUMB_COL) or "",
        "twist": cell(TWIST_COL) or "",
    }


def _explain_from_why_end(why_end):
    """
    "Why Viewers Watch to the End" is written as a description of what the
    video reveals, e.g. "Reveals the exact resequencing trick, then the
    lawsuit that exposed it." -- reusable almost verbatim as narration.
    """
    text = why_end.strip()
    if text and text[0].isupper() and text.split()[0].endswith(("s", "y")):
        # Looks like "Reveals ..." / "Explains ..." -- fine as-is.
        return text
    return f"Here's what's actually going on: {text[0].lower()}{text[1:]}" if text else ""


def _n_images(visuals_needed_str):
    nums = [int(n) for n in re.findall(r"\d+", str(visuals_needed_str))]
    if not nums:
        return 5
    n = round(sum(nums) / len(nums))
    return max(4, min(8, n))


def build_script(row):
    from .overrides import MANUAL_SCRIPTS

    # Keyed by slugified title, not rank -- rank is only unique within a
    # single sheet, and the four content-system sheets each have their own
    # "rank 1", "rank 2", etc. Keying by rank alone would make one sheet's
    # override silently clobber another's for the same rank number.
    override_key = slugify(row["title"])
    if override_key in MANUAL_SCRIPTS:
        return MANUAL_SCRIPTS[override_key]

    hook = row["hook"].rstrip(".") + "."
    gap = row["gap"].rstrip("?") + "?" if row["gap"] else ""
    explain = _explain_from_why_end(row["why_end"])
    twist = row["twist"].strip()
    twist_line = f"And here's the payoff: {twist[0].lower()}{twist[1:]}." if twist else ""
    outro = "Now you know exactly how it works."

    beat_texts = [t for t in [hook, gap, explain, twist_line, outro] if t]
    full_text = " ".join(beat_texts)

    beats = [Beat(caption=t, words=len(t.split())) for t in beat_texts]

    n_images = _n_images(row["visuals_needed"])
    style = row["visual_style"]
    palette = row["palette"]
    base_subject = row["title"]

    prompts = []
    # One prompt tied to each narrative beat first, in order...
    for i, t in enumerate(beat_texts):
        shot = SHOT_VARIANTS[i % len(SHOT_VARIANTS)]
        prompts.append(
            ImagePrompt(
                prompt=f"{style}. {shot} illustrating: {base_subject}. Palette: {palette}. "
                       f"No text, no watermark, no logos.",
                weight=max(len(t.split()), 3),
            )
        )
    # ...then pad with extra shot variants of the same style if more visuals
    # were called for than there are narrative beats, so a fast-cut video
    # still has enough distinct images.
    extra_i = 0
    while len(prompts) < n_images:
        shot = SHOT_VARIANTS[(len(beat_texts) + extra_i) % len(SHOT_VARIANTS)]
        prompts.append(
            ImagePrompt(
                prompt=f"{style}. {shot} illustrating: {base_subject}. Palette: {palette}. "
                       f"No text, no watermark, no logos.",
                weight=6,
            )
        )
        extra_i += 1

    thumbnail_prompt = (
        f"{style}. Thumbnail composition: {row['thumb_concept']}. Palette: {palette}. "
        f"Bold, high-contrast, single clear focal point. No text, no watermark, no logos."
    )

    return Script(
        rank=row["rank"],
        title=row["title"],
        slug=slugify(row["title"]),
        full_text=full_text,
        beats=beats,
        image_prompts=prompts,
        thumbnail_prompt=thumbnail_prompt,
    )

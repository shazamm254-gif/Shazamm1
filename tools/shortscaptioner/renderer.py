#!/usr/bin/env python3
"""
renderer.py — chunking, styling and frame compositing for ShortsCaptioner.

Four jobs live here:

1. `chunk_words()` groups the word stream into 2-4 word cards so the screen
   never gets crowded, breaking on pauses and sentence ends.
2. `CaptionRenderer` turns one chunk (plus the current time) into a transparent
   overlay: heavy font, white fill, thick black stroke, drop shadow, the active
   word swapped to the highlight colour, and both animations from
   `AnimationStyle` applied — the card springing in and the active word
   bouncing.
3. `concat_clips()` joins several source clips with a transition, so a Short cut
   from multiple takes can be captioned as one continuous timeline.
4. `render_video()` streams the source video through ffmpeg, composites the
   overlay onto each frame, and pipes the result back out to an H.264 MP4
   with the original audio re-attached.

Animation is what makes caching non-trivial: an overlay now depends on time,
not just on which word is active. Phases are quantised — and the number of
phases capped by how many frames the animation actually spans — so a card that
sits on screen for 40 frames still rasterises only a handful of images. The
per-frame cost stays an alpha blend over a small bounding box.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from collections import OrderedDict
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from whisper_helper import Word


class FontNotFoundError(RuntimeError):
    """Raised when the requested font file can't be located or opened."""


class RenderError(RuntimeError):
    """Raised when ffmpeg probing, decoding or encoding fails."""


# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------

NAMED_COLORS = {
    "white": (255, 255, 255),
    "black": (0, 0, 0),
    "yellow": (255, 222, 89),      # the Hormozi yellow
    "neon": (57, 255, 20),
    "green": (57, 255, 20),
    "lime": (204, 255, 0),
    "red": (255, 59, 48),
    "orange": (255, 149, 0),
    "pink": (255, 45, 133),
    "cyan": (0, 229, 255),
    "blue": (0, 122, 255),
    "purple": (175, 82, 222),
}


def parse_color(value, default_alpha: int = 255) -> tuple[int, int, int, int]:
    """Accept '#FFDE59', 'FFDE59', 'yellow', or '255,222,89' -> RGBA tuple."""
    if isinstance(value, (tuple, list)):
        parts = list(value)
        if len(parts) == 3:
            parts.append(default_alpha)
        return tuple(int(p) for p in parts[:4])

    text = str(value).strip().lower()
    if text in NAMED_COLORS:
        return NAMED_COLORS[text] + (default_alpha,)

    if "," in text:
        parts = [int(p) for p in text.split(",")]
        if len(parts) == 3:
            parts.append(default_alpha)
        if len(parts) != 4:
            raise ValueError(f"Could not read colour {value!r}.")
        return tuple(max(0, min(255, p)) for p in parts)

    hex_text = text.lstrip("#")
    if len(hex_text) == 3:
        hex_text = "".join(c * 2 for c in hex_text)
    if len(hex_text) == 6:
        hex_text += f"{default_alpha:02x}"
    if len(hex_text) != 8:
        raise ValueError(
            f"Could not read colour {value!r}. Use #RRGGBB, a name "
            f"({', '.join(sorted(NAMED_COLORS))}), or 'R,G,B'."
        )
    try:
        return tuple(int(hex_text[i:i + 2], 16) for i in (0, 2, 4, 6))
    except ValueError as exc:
        raise ValueError(f"Could not read colour {value!r}.") from exc


# ---------------------------------------------------------------------------
# Fonts
# ---------------------------------------------------------------------------

_HERE = os.path.dirname(os.path.abspath(__file__))

FONT_SEARCH_DIRS = [
    os.path.join(_HERE, "fonts"),
    os.path.join(os.getcwd(), "fonts"),
    os.getcwd(),
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    os.path.expanduser("~/.fonts"),
    os.path.expanduser("~/.local/share/fonts"),
    "/Library/Fonts",
    "/System/Library/Fonts",
    "/System/Library/Fonts/Supplemental",
    os.path.expanduser("~/Library/Fonts"),
    "C:/Windows/Fonts",
]

FONT_EXTENSIONS = (".ttf", ".otf", ".ttc")


def available_fonts(limit: int | None = None) -> list[str]:
    """Every font file we can see, so an error message can offer real options."""
    found: list[str] = []
    seen: set[str] = set()
    for directory in FONT_SEARCH_DIRS:
        if not os.path.isdir(directory):
            continue
        for root, _dirs, files in os.walk(directory):
            for name in sorted(files):
                if not name.lower().endswith(FONT_EXTENSIONS):
                    continue
                path = os.path.join(root, name)
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)
                found.append(path)
                if limit and len(found) >= limit:
                    return found
    return found


def find_font(name_or_path: str) -> str:
    """Resolve a font argument to a real file, searching the usual places.

    Accepts a full path, a bare filename ('Montserrat-Black.ttf'), or a family
    stem ('bebasneue'). Raises FontNotFoundError with concrete suggestions
    rather than letting Pillow fail with a bare OSError deep in the render.
    """
    if not name_or_path:
        raise FontNotFoundError("No font given. Pass --font <path-to-ttf>.")

    if os.path.isfile(name_or_path):
        return os.path.abspath(name_or_path)

    target = os.path.basename(name_or_path).lower()
    stem = os.path.splitext(target)[0]
    has_extension = target.lower().endswith(FONT_EXTENSIONS)

    exact: list[str] = []
    partial: list[str] = []
    for path in available_fonts():
        filename = os.path.basename(path).lower()
        if filename == target:
            exact.append(path)
        elif not has_extension and os.path.splitext(filename)[0] == stem:
            exact.append(path)
        elif stem and stem in filename.replace(" ", "").replace("_", ""):
            partial.append(path)

    if exact:
        return exact[0]
    if partial:
        return partial[0]

    suggestions = available_fonts(limit=12)
    hint = "\n".join(f"    {p}" for p in suggestions) or "    (none found)"
    raise FontNotFoundError(
        f"Font {name_or_path!r} not found.\n\n"
        f"Put a .ttf in {os.path.join(_HERE, 'fonts')}/ or pass a full path.\n"
        f"Good free picks: Montserrat-Black, BebasNeue-Regular, Anton-Regular, "
        f"TheBoldFont — all on Google Fonts.\n\n"
        f"Fonts I can see right now:\n{hint}"
    )


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    resolved = find_font(path)
    try:
        return ImageFont.truetype(resolved, size)
    except OSError as exc:
        raise FontNotFoundError(
            f"Pillow could not open {resolved!r} at size {size}: {exc}\n"
            f"The file may be corrupt, a bitmap-only font, or not a "
            f"TrueType/OpenType font at all."
        ) from exc


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

SENTENCE_END = ".!?"
DISPLAY_STRIP = ",;:\"'`()[]{}"


@dataclass
class Chunk:
    """A group of words shown together on one caption card."""

    words: list[Word]
    start: float
    end: float
    display_until: float = 0.0

    @property
    def texts(self) -> list[str]:
        return [w.text for w in self.words]

    def active_index(self, t: float) -> int:
        """Index of the word being spoken at time `t`.

        The last word whose start has passed stays lit until the next one
        begins — highlighting nothing during a short breath reads as a glitch.
        """
        index = 0
        for i, word in enumerate(self.words):
            if word.start <= t:
                index = i
            else:
                break
        return index


def _display_text(raw: str, uppercase: bool, keep_punctuation: bool) -> str:
    text = raw.strip()
    if not keep_punctuation:
        text = text.strip(DISPLAY_STRIP)
        # Keep ? and ! — they carry the delivery. Everything else is clutter.
        while text and text[-1] == ".":
            text = text[:-1]
    return text.upper() if uppercase else text


def chunk_words(
    words: list[Word],
    max_words: int = 4,
    min_words: int = 2,
    max_chars: int = 22,
    gap_threshold: float = 0.45,
    break_on_sentence: bool = True,
    hold_gap: float = 0.6,
) -> list[Chunk]:
    """Group words into short caption cards.

    A card ends when it hits `max_words`, would exceed `max_chars`, the speaker
    pauses longer than `gap_threshold`, or a sentence closes. `min_words` only
    influences the tail: a lone trailing word gets merged back rather than
    flashing on its own.
    """
    if not words:
        return []

    max_words = max(1, max_words)
    min_words = max(1, min(min_words, max_words))

    groups: list[list[Word]] = []
    current: list[Word] = []
    current_chars = 0

    for word in words:
        clean_len = len(word.text.strip())
        gap = word.start - current[-1].end if current else 0.0

        should_break = bool(current) and (
            len(current) >= max_words
            or gap >= gap_threshold
            or (current_chars + 1 + clean_len > max_chars
                and len(current) >= min_words)
        )
        if should_break:
            groups.append(current)
            current, current_chars = [], 0

        current.append(word)
        current_chars += clean_len + (1 if current_chars else 0)

        if break_on_sentence and word.text.strip().endswith(tuple(SENTENCE_END)):
            groups.append(current)
            current, current_chars = [], 0

    if current:
        groups.append(current)

    # A lone word at the very end reads as a mistake rather than a beat. Fold
    # it into the previous card if that stays within max_words; otherwise push
    # words back across the boundary so both cards are a sensible length.
    if len(groups) >= 2 and len(groups[-1]) < min_words:
        previous, last = groups[-2], groups[-1]
        adjacent = last[0].start - previous[-1].end < gap_threshold
        if adjacent and len(previous) + len(last) <= max_words:
            groups[-2] = previous + last
            groups.pop()
        elif adjacent and len(previous) + len(last) >= 2 * min_words:
            move = min_words - len(last)
            groups[-2], groups[-1] = previous[:-move], previous[-move:] + last

    chunks = [Chunk(words=g, start=g[0].start, end=g[-1].end) for g in groups]

    # Hold each card until the next one starts when the gap is short, so the
    # screen doesn't blink empty between two halves of the same sentence.
    for i, chunk in enumerate(chunks):
        if i + 1 < len(chunks):
            gap = chunks[i + 1].start - chunk.end
            chunk.display_until = (chunks[i + 1].start if gap <= hold_gap
                                   else chunk.end + 0.15)
        else:
            chunk.display_until = chunk.end + 0.25
    return chunks


# ---------------------------------------------------------------------------
# Style
# ---------------------------------------------------------------------------

@dataclass
class CaptionStyle:
    """Everything about how the captions look. Sizes of 0 mean 'auto'."""

    font_path: str = "Montserrat-Black.ttf"
    font_size: int = 0
    text_color: tuple = (255, 255, 255, 255)
    highlight_color: tuple = (255, 222, 89, 255)
    stroke_color: tuple = (0, 0, 0, 255)
    stroke_width: int = 0
    highlight_style: str = "color"      # color | box | both
    box_text_color: tuple = (0, 0, 0, 255)
    box_radius_ratio: float = 0.18
    box_padding_ratio: float = 0.14
    shadow: bool = True
    shadow_offset_ratio: float = 0.06
    shadow_blur_ratio: float = 0.07
    shadow_opacity: float = 0.55
    position: float = 0.55              # vertical centre as a fraction of height
    max_width_ratio: float = 0.86
    uppercase: bool = True
    keep_punctuation: bool = False
    line_spacing: float = 0.14
    pop_scale: float = 1.10             # how much the active word grows
    word_spacing: float = 1.0

    def resolved_font_size(self, width: int, height: int) -> int:
        if self.font_size > 0:
            return self.font_size
        # ~9.5% of frame width lands close to the Hormozi/TikTok caption scale
        # on a 1080x1920 export without wrapping short chunks.
        return max(18, int(round(width * 0.095)))

    def resolved_stroke_width(self, font_size: int) -> int:
        if self.stroke_width > 0:
            return self.stroke_width
        return max(3, int(round(font_size * 0.045)))


# ---------------------------------------------------------------------------
# Animation
# ---------------------------------------------------------------------------

def ease_out_cubic(t: float) -> float:
    """Fast start, soft landing. Never overshoots."""
    t = min(1.0, max(0.0, t))
    return 1.0 - (1.0 - t) ** 3


def ease_out_back(t: float, overshoot: float = 1.70158) -> float:
    """Like ease_out_cubic but sails past 1.0 and settles back — the springy
    feel every short-form editor uses for text entrances."""
    t = min(1.0, max(0.0, t))
    c1 = overshoot
    c3 = c1 + 1.0
    return 1.0 + c3 * (t - 1.0) ** 3 + c1 * (t - 1.0) ** 2


@dataclass
class AnimationStyle:
    """Timing and strength of the caption motion.

    Two independent animations run on every card:

    * the **card pop-in**, which scales the whole block up from
      `pop_in_from` with a springy overshoot as the card appears, and
    * the **word bounce**, which kicks the newly active word above its resting
      `CaptionStyle.pop_scale` and lets it settle.

    Both are driven off the audio timestamps rather than a frame counter, so
    they look identical at 24, 30 or 60 fps.
    """

    enabled: bool = True

    # Card pop-in.
    pop_in: bool = True
    pop_in_duration: float = 0.18
    pop_in_from: float = 0.72       # starting scale of the block
    pop_in_fade: bool = True
    pop_in_overshoot: float = 1.9   # higher = springier

    # Active-word bounce, added on top of the resting pop_scale. Kept small on
    # purpose: pop_scale already carries the 10-15% size jump, and this is the
    # transient overshoot that makes the jump read as a bounce rather than a
    # step. Much past ~0.10 and it goes cartoonish.
    word_bounce: float = 0.08       # peak is pop_scale + this
    word_bounce_duration: float = 0.13

    # Animated overlays are rasterised per phase, so phases are quantised and
    # the results cached. This is the ceiling; the renderer lowers it to the
    # number of frames an animation actually spans, since rasterising more
    # distinct phases than there are frames to show them is pure waste.
    steps: int = 6

    def quantise(self, progress: float, steps: int | None = None) -> int:
        steps = self.steps if steps is None else steps
        return int(round(min(1.0, max(0.0, progress)) * steps))

    def phase(self, step: int, steps: int | None = None) -> float:
        steps = self.steps if steps is None else steps
        return step / steps if steps else 1.0

    def peak_word_scale(self, rest_scale: float) -> float:
        """Largest the active word ever gets — what the layout must reserve."""
        if not self.enabled:
            return rest_scale
        return rest_scale + max(0.0, self.word_bounce)

    def word_scale(self, rest_scale: float, phase: float) -> float:
        """Snap to the peak the instant a word goes active, then settle."""
        if not self.enabled or self.word_bounce <= 0:
            return rest_scale
        return rest_scale + self.word_bounce * (1.0 - ease_out_cubic(phase))

    def block_scale(self, phase: float) -> float:
        if not (self.enabled and self.pop_in):
            return 1.0
        eased = ease_out_back(phase, self.pop_in_overshoot)
        # eased passes above 1.0 mid-flight, which flips the sign here and
        # carries the block just past full size before it settles.
        return 1.0 + (self.pop_in_from - 1.0) * (1.0 - eased)

    # A card is held on screen until the next one starts, so a fade that began
    # at zero would leave one fully blank frame whenever a frame lands exactly
    # on a card boundary — a visible blink. Starting part-way up avoids that
    # and still reads as a fade.
    FADE_FLOOR = 0.3

    def block_alpha(self, phase: float) -> float:
        if not (self.enabled and self.pop_in and self.pop_in_fade):
            return 1.0
        # Solid by half way through the pop: a fade that tracks the scale all
        # the way reads as sluggish.
        eased = ease_out_cubic(min(1.0, phase / 0.5))
        return self.FADE_FLOOR + (1.0 - self.FADE_FLOOR) * eased


@dataclass
class _PlacedWord:
    text: str
    x: float
    baseline: float
    width: float


@dataclass
class Overlay:
    """A cropped RGBA overlay plus where it belongs on the frame."""

    rgb: np.ndarray            # (h, w, 3) uint8
    alpha: np.ndarray          # (h, w, 1) float32 in 0..1
    x: int
    y: int


# ---------------------------------------------------------------------------
# Renderer
# ---------------------------------------------------------------------------

class CaptionRenderer:
    """Draws caption overlays for a given frame size and style."""

    # Animated overlays are cached per quantised phase, and each one costs a
    # couple of megabytes. Frames are rendered in time order so the working set
    # is tiny; these bounds only exist to stop a long video growing unbounded.
    LAYER_CACHE_SIZE = 24
    OVERLAY_CACHE_SIZE = 48

    def __init__(self, width: int, height: int, style: CaptionStyle,
                 animation: AnimationStyle | None = None, fps: float = 30.0):
        self.width = width
        self.height = height
        self.style = style
        self.animation = animation or AnimationStyle()
        self.fps = fps if fps and fps > 0 else 30.0

        self.font_size = style.resolved_font_size(width, height)
        self.stroke_width = style.resolved_stroke_width(self.font_size)
        self.font = load_font(style.font_path, self.font_size)
        self.font_path = find_font(style.font_path)

        # The layout has to leave room for the biggest the active word ever
        # gets, which is the bounce peak rather than the resting pop scale.
        self.peak_word_scale = self.animation.peak_word_scale(style.pop_scale)

        # A 0.13s bounce spans 4 frames at 30 fps, so 4 phases is every
        # distinct image that will ever be shown — anything finer is rendered
        # and then thrown away.
        self.word_steps = self._steps_for(self.animation.word_bounce_duration)
        self.pop_steps = self._steps_for(self.animation.pop_in_duration)

        self._font_cache: dict[int, ImageFont.FreeTypeFont] = {
            self.font_size: self.font
        }
        self._layer_cache: OrderedDict[tuple, tuple] = OrderedDict()
        self._overlay_cache: OrderedDict[tuple, Overlay | None] = OrderedDict()
        self._measure = ImageDraw.Draw(Image.new("RGBA", (1, 1)))

        self.ascent, self.descent = self.font.getmetrics()
        self.line_height = self.ascent + self.descent
        self.line_gap = int(round(self.line_height * style.line_spacing))
        self.space_width = self._measure.textlength(
            " ", font=self.font) * style.word_spacing
        # Wrapping happens on painted width, so reserve room for the stroke.
        self.max_text_width = (width * style.max_width_ratio
                               - self.stroke_width * 2)

    def _steps_for(self, duration: float) -> int:
        return max(1, min(self.animation.steps,
                          int(round(duration * self.fps))))

    # -- fonts --------------------------------------------------------------

    def _font_at(self, size: int) -> ImageFont.FreeTypeFont:
        font = self._font_cache.get(size)
        if font is None:
            font = ImageFont.truetype(self.font_path, size)
            self._font_cache[size] = font
        return font

    def _text_width(self, text: str) -> float:
        return self._measure.textlength(text, font=self.font)

    # -- layout -------------------------------------------------------------

    def layout(self, texts: list[str]) -> tuple[list[list[_PlacedWord]], tuple[int, int, int, int]]:
        """Wrap `texts` into centred lines and return placements + bounding box.

        Words keep their own x/width so the active one can be recoloured or
        scaled in place without the rest of the line shifting.
        """
        # Only one word pops at a time, so the gap between two neighbours has
        # to clear the wider of the two growing into it — otherwise the active
        # word visually collides with the one beside it. Reserve for the bounce
        # peak, not the resting scale, or the overshoot frames collide.
        grow = max(0.0, self.peak_word_scale - 1.0) / 2.0

        def gap_between(left_width: float, right_width: float) -> float:
            return self.space_width + max(left_width, right_width) * grow

        lines: list[list[tuple[str, float]]] = []
        current: list[tuple[str, float]] = []
        current_width = 0.0

        for text in texts:
            word_width = self._text_width(text)
            advance = word_width
            if current:
                advance += gap_between(current[-1][1], word_width)
            if current and current_width + advance > self.max_text_width:
                lines.append(current)
                current, current_width = [(text, word_width)], word_width
            else:
                current.append((text, word_width))
                current_width += advance
        if current:
            lines.append(current)

        block_height = (len(lines) * self.line_height
                        + max(0, len(lines) - 1) * self.line_gap)
        top = int(round(self.height * self.style.position - block_height / 2))

        placed: list[list[_PlacedWord]] = []
        min_x, max_x = float("inf"), float("-inf")
        widest = 0.0
        for line_index, line in enumerate(lines):
            gaps = sum(gap_between(line[i][1], line[i + 1][1])
                       for i in range(len(line) - 1))
            line_width = sum(w for _, w in line) + gaps
            x = (self.width - line_width) / 2
            baseline = (top + line_index * (self.line_height + self.line_gap)
                        + self.ascent)
            row: list[_PlacedWord] = []
            for index, (text, word_width) in enumerate(line):
                row.append(_PlacedWord(text, x, baseline, word_width))
                min_x = min(min_x, x)
                max_x = max(max_x, x + word_width)
                widest = max(widest, word_width)
                x += word_width
                if index + 1 < len(line):
                    x += gap_between(word_width, line[index + 1][1])
            placed.append(row)

        # Pad the box for stroke, shadow, blur and the active-word pop.
        pop_pad = int(widest * grow) + 4
        pad = (self.stroke_width * 2 + pop_pad
               + int(self.font_size * (self.style.shadow_blur_ratio
                                       + self.style.shadow_offset_ratio)) + 6)
        box = (
            max(0, int(min_x) - pad),
            max(0, top - pad),
            min(self.width, int(max_x) + pad),
            min(self.height, top + block_height + pad),
        )
        return placed, box

    # -- drawing ------------------------------------------------------------

    def _draw_word(self, draw: ImageDraw.ImageDraw, word: _PlacedWord,
                   fill, stroke_fill, stroke_width: int, scale: float) -> None:
        if scale != 1.0:
            # Scale about the word's centre so neighbours never move.
            font = self._font_at(max(1, int(round(self.font_size * scale))))
            draw.text(
                (word.x + word.width / 2, word.baseline),
                word.text, font=font, fill=fill, anchor="ms",
                stroke_width=int(round(stroke_width * scale)),
                stroke_fill=stroke_fill,
            )
        else:
            draw.text(
                (word.x, word.baseline), word.text, font=self.font, fill=fill,
                anchor="ls", stroke_width=stroke_width, stroke_fill=stroke_fill,
            )

    def _draw_highlight_box(self, draw: ImageDraw.ImageDraw,
                            word: _PlacedWord, scale: float) -> None:
        pad_x = self.font_size * self.style.box_padding_ratio
        pad_y = self.font_size * self.style.box_padding_ratio * 0.7
        half = word.width * scale / 2
        cx = word.x + word.width / 2
        rect = (
            cx - half - pad_x,
            word.baseline - self.ascent * scale - pad_y,
            cx + half + pad_x,
            word.baseline + self.descent * scale * 0.6 + pad_y,
        )
        radius = self.font_size * self.style.box_radius_ratio
        draw.rounded_rectangle(rect, radius=radius,
                               fill=self.style.highlight_color)

    def _render_layer(self, chunk: Chunk, active_index: int,
                      word_scale: float) -> tuple[Image.Image, int, int] | None:
        """Rasterise one card with the active word drawn at `word_scale`.

        Returns the RGBA layer and where its top-left sits on the frame. The
        card-level pop-in is applied afterwards as a transform of this image,
        so the expensive part — text, strokes and the blurred shadow — is only
        redrawn when the *word* scale changes.
        """
        style = self.style
        texts = [
            _display_text(w.text, style.uppercase, style.keep_punctuation)
            for w in chunk.words
        ]
        keep = [i for i, t in enumerate(texts) if t]
        texts = [texts[i] for i in keep]
        if not texts:
            return None
        # Punctuation-only words can be dropped above, so remap the active index
        # onto the words that actually survived.
        active = keep.index(active_index) if active_index in keep else max(
            0, sum(1 for i in keep if i < active_index) - 1)

        placed, box = self.layout(texts)
        x0, y0, x1, y1 = box
        size = (max(1, x1 - x0), max(1, y1 - y0))

        layer = Image.new("RGBA", size, (0, 0, 0, 0))
        flat = [w for row in placed for w in row]
        for word in flat:
            word.x -= x0
            word.baseline -= y0

        use_box = style.highlight_style in ("box", "both")
        use_color = style.highlight_style in ("color", "both")

        def scale_for(index: int) -> float:
            return word_scale if index == active and word_scale != 1.0 else 1.0

        if style.shadow:
            # The shadow is pure black, so all its information lives in the
            # alpha channel — drawing and blurring a single-band mask instead
            # of a full RGBA image is ~3x faster, and blurring is the most
            # expensive step in rasterising a card.
            alpha = int(255 * style.shadow_opacity)
            mask = Image.new("L", size, 0)
            mask_draw = ImageDraw.Draw(mask)
            offset = self.font_size * style.shadow_offset_ratio
            for index, word in enumerate(flat):
                ghost = _PlacedWord(word.text, word.x,
                                    word.baseline + offset, word.width)
                self._draw_word(mask_draw, ghost, alpha, alpha,
                                self.stroke_width, scale_for(index))
            blur = self.font_size * style.shadow_blur_ratio
            if blur > 0:
                mask = mask.filter(ImageFilter.GaussianBlur(blur))
            shadow = Image.new("RGBA", size, (0, 0, 0, 0))
            shadow.putalpha(mask)
            layer = Image.alpha_composite(layer, shadow)

        draw = ImageDraw.Draw(layer)
        if use_box and flat:
            self._draw_highlight_box(draw, flat[active], scale_for(active))

        for index, word in enumerate(flat):
            is_active = index == active
            if is_active and use_box and not use_color:
                fill = style.box_text_color
            elif is_active and use_color:
                fill = style.highlight_color
            else:
                fill = style.text_color
            self._draw_word(draw, word, fill, style.stroke_color,
                            self.stroke_width, scale_for(index))

        return layer, x0, y0

    # -- caching ------------------------------------------------------------

    @staticmethod
    def _cache_get(cache: OrderedDict, key, maxsize: int, build):
        """Bounded LRU. Frames arrive in time order, so the working set is the
        card currently on screen — the bound only caps a long video's growth."""
        if key in cache:
            cache.move_to_end(key)
            return cache[key]
        value = build()
        cache[key] = value
        while len(cache) > maxsize:
            cache.popitem(last=False)
        return value

    def _layer_at(self, chunk_index: int, chunk: Chunk, active_index: int,
                  word_step: int):
        anim = self.animation
        word_scale = anim.word_scale(
            self.style.pop_scale, anim.phase(word_step, self.word_steps))
        return self._cache_get(
            self._layer_cache, (chunk_index, active_index, word_step),
            self.LAYER_CACHE_SIZE,
            lambda: self._render_layer(chunk, active_index, word_scale),
        )

    def _transform(self, layer_result, block_scale: float,
                   block_alpha: float) -> Overlay | None:
        """Scale and fade a rasterised card, then hand back a compositable
        overlay. The card grows about the caption anchor rather than its own
        bounding box, so a two-line card doesn't drift as it pops in."""
        if layer_result is None:
            return None
        layer, x0, y0 = layer_result

        if block_scale != 1.0:
            anchor_x = self.width / 2.0
            anchor_y = self.height * self.style.position
            new_size = (max(1, int(round(layer.width * block_scale))),
                        max(1, int(round(layer.height * block_scale))))
            # BICUBIC over LANCZOS: the card is moving fast enough during a
            # ~5-frame entrance that the difference is invisible, and it still
            # resamples cleanly enough not to shimmer on the way down.
            layer = layer.resize(new_size, Image.BICUBIC)
            x0 = int(round(anchor_x + (x0 - anchor_x) * block_scale))
            y0 = int(round(anchor_y + (y0 - anchor_y) * block_scale))

        array = np.asarray(layer, dtype=np.uint8)
        alpha = array[:, :, 3:4].astype(np.float32) / 255.0
        if block_alpha < 1.0:
            alpha = alpha * block_alpha
        return Overlay(
            rgb=np.ascontiguousarray(array[:, :, :3]),
            alpha=np.ascontiguousarray(alpha),
            x=x0,
            y=y0,
        )

    def overlay_at(self, chunk_index: int, chunk: Chunk,
                   t: float) -> Overlay | None:
        """The fully animated overlay for this card at time `t`.

        Both animations are quantised into `AnimationStyle.steps` phases so a
        card that lingers for 40 frames still only rasterises a handful of
        distinct images.
        """
        anim = self.animation
        active = chunk.active_index(t)

        if anim.enabled and anim.word_bounce > 0:
            elapsed = t - chunk.words[active].start
            word_step = anim.quantise(elapsed / anim.word_bounce_duration,
                                      self.word_steps)
        else:
            word_step = self.word_steps

        if anim.enabled and anim.pop_in:
            chunk_step = anim.quantise((t - chunk.start) / anim.pop_in_duration,
                                       self.pop_steps)
        else:
            chunk_step = self.pop_steps

        pop_phase = anim.phase(chunk_step, self.pop_steps)
        return self._cache_get(
            self._overlay_cache,
            (chunk_index, active, word_step, chunk_step),
            self.OVERLAY_CACHE_SIZE,
            lambda: self._transform(
                self._layer_at(chunk_index, chunk, active, word_step),
                anim.block_scale(pop_phase),
                anim.block_alpha(pop_phase),
            ),
        )

    def render_overlay(self, chunk: Chunk, active_index: int) -> Overlay | None:
        """The settled, un-animated overlay — the state a card rests in."""
        return self._transform(
            self._render_layer(chunk, active_index, self.style.pop_scale),
            1.0, 1.0)

    @staticmethod
    def composite(frame: np.ndarray, overlay: Overlay) -> np.ndarray:
        """Alpha-blend an overlay onto an RGB frame, in place.

        The pop-in overshoots past full size, so an overlay can extend beyond
        any edge of the frame — both source and destination are clipped.
        """
        oh, ow = overlay.rgb.shape[:2]
        fh, fw = frame.shape[:2]
        sx, sy = max(0, -overlay.x), max(0, -overlay.y)
        dx, dy = max(0, overlay.x), max(0, overlay.y)
        w = min(ow - sx, fw - dx)
        h = min(oh - sy, fh - dy)
        if w <= 0 or h <= 0:
            return frame
        region = frame[dy:dy + h, dx:dx + w].astype(np.float32)
        rgb = overlay.rgb[sy:sy + h, sx:sx + w].astype(np.float32)
        alpha = overlay.alpha[sy:sy + h, sx:sx + w]
        frame[dy:dy + h, dx:dx + w] = (
            region * (1.0 - alpha) + rgb * alpha).astype(np.uint8)
        return frame

    def render_still(self, chunk: Chunk, active_index: int,
                     background: np.ndarray | None = None,
                     t: float | None = None) -> Image.Image:
        """One composited frame as a PIL image — handy for style previews.

        Pass `t` to sample a moment in the animation; omit it for the card's
        settled state.
        """
        if background is None:
            background = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        frame = background.copy()
        overlay = (self.render_overlay(chunk, active_index) if t is None
                   else self.overlay_at(0, chunk, t))
        if overlay is not None:
            self.composite(frame, overlay)
        return Image.fromarray(frame)


# ---------------------------------------------------------------------------
# ffmpeg plumbing
# ---------------------------------------------------------------------------

def require_ffmpeg() -> tuple[str, str]:
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise RenderError(
            "ffmpeg/ffprobe were not found on your PATH.\n"
            "  macOS:   brew install ffmpeg\n"
            "  Ubuntu:  sudo apt install ffmpeg\n"
            "  Windows: winget install Gyan.FFmpeg"
        )
    return ffmpeg, ffprobe


@dataclass
class VideoInfo:
    width: int
    height: int
    fps: float
    duration: float
    has_audio: bool = True
    frame_count: int = 0

    @property
    def aspect(self) -> float:
        return self.width / self.height if self.height else 0.0


def probe_video(path: str) -> VideoInfo:
    _, ffprobe = require_ffmpeg()
    if not os.path.exists(path):
        raise RenderError(f"Input video not found: {path}")

    cmd = [ffprobe, "-v", "error", "-print_format", "json",
           "-show_streams", "-show_format", path]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RenderError(f"ffprobe failed on {path!r}:\n{proc.stderr.strip()}")

    data = json.loads(proc.stdout)
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video is None:
        raise RenderError(f"{path!r} has no video stream.")
    has_audio = any(s.get("codec_type") == "audio" for s in streams)

    rate = video.get("avg_frame_rate") or video.get("r_frame_rate") or "30/1"
    try:
        num, _, den = rate.partition("/")
        fps = float(num) / float(den or 1)
    except (ValueError, ZeroDivisionError):
        fps = 30.0
    if not fps or fps <= 0:
        fps = 30.0

    duration = float(data.get("format", {}).get("duration")
                     or video.get("duration") or 0.0)
    try:
        frame_count = int(video.get("nb_frames") or 0)
    except ValueError:
        frame_count = 0
    if not frame_count and duration:
        frame_count = int(round(duration * fps))

    return VideoInfo(
        width=int(video["width"]), height=int(video["height"]), fps=fps,
        duration=duration, has_audio=has_audio, frame_count=frame_count,
    )


# Names we expose mapped onto ffmpeg's xfade transitions. "cut" is the odd one
# out — it needs no xfade at all, just a straight concat.
TRANSITIONS = {
    "cut": None,
    "crossfade": "fade",
    "fadeblack": "fadeblack",
    "fadewhite": "fadewhite",
    "dissolve": "dissolve",
    "slideleft": "slideleft",
    "slideright": "slideright",
    "wipeleft": "wipeleft",
    "wipeup": "wipeup",
    "circleopen": "circleopen",
    "smoothleft": "smoothleft",
}


def concat_clips(
    paths: list[str],
    output: str,
    transition: str = "crossfade",
    duration: float = 0.5,
    width: int | None = None,
    height: int | None = None,
    fps: float | None = None,
    crf: int = 18,
    preset: str = "medium",
    audio_bitrate: str = "192k",
    verbose: bool = True,
) -> str:
    """Join several clips into one, with a transition between each pair.

    Everything is normalised to a single size, frame rate and audio format
    first — xfade and concat both refuse mismatched inputs, and clips shot on
    different devices are almost never an exact match. Clips narrower or wider
    than the target are letterboxed rather than stretched.

    Returns `output`, or the single input path unchanged if only one was given.
    """
    if not paths:
        raise RenderError("No clips given to join.")
    if len(paths) == 1:
        return paths[0]
    if transition not in TRANSITIONS:
        raise RenderError(
            f"Unknown transition {transition!r}. Options: "
            f"{', '.join(sorted(TRANSITIONS))}.")

    ffmpeg, _ = require_ffmpeg()
    infos = [probe_video(path) for path in paths]

    target_w = width or infos[0].width
    target_h = height or infos[0].height
    target_fps = fps or infos[0].fps
    # xfade offsets are computed from durations, so an unknown one would put
    # every later clip at the wrong time.
    for path, info in zip(paths, infos):
        if info.duration <= 0:
            raise RenderError(
                f"Could not read the duration of {path!r}, which is needed to "
                f"place the transitions. Re-encode it first:\n"
                f"    ffmpeg -i {path} -c:v libx264 -c:a aac fixed.mp4")

    xfade = TRANSITIONS[transition]
    if xfade:
        shortest = min(info.duration for info in infos)
        if duration >= shortest:
            duration = max(0.05, shortest * 0.4)
            if verbose:
                print(f"  Transition longer than the shortest clip "
                      f"({shortest:.2f}s) — trimmed to {duration:.2f}s")

    # Clips without audio get a silent track so the audio graph stays uniform;
    # mixing "has audio" and "doesn't" is what breaks naive concat scripts.
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    audio_input = {}
    for index, path in enumerate(paths):
        cmd += ["-i", path]
    next_input = len(paths)
    for index, info in enumerate(infos):
        if info.has_audio:
            audio_input[index] = f"{index}:a:0"
        else:
            cmd += ["-f", "lavfi", "-t", f"{info.duration:.4f}",
                    "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"]
            audio_input[index] = f"{next_input}:a"
            next_input += 1

    steps = []
    for index in range(len(paths)):
        steps.append(
            f"[{index}:v:0]scale={target_w}:{target_h}"
            f":force_original_aspect_ratio=decrease,"
            f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:color=black,"
            f"setsar=1,fps={target_fps},format=yuv420p[v{index}]"
        )
        steps.append(
            f"[{audio_input[index]}]aformat=sample_fmts=fltp"
            f":sample_rates=48000:channel_layouts=stereo[a{index}]"
        )

    if xfade is None:
        video_pads = "".join(f"[v{i}]" for i in range(len(paths)))
        audio_pads = "".join(f"[a{i}]" for i in range(len(paths)))
        steps.append(f"{video_pads}concat=n={len(paths)}:v=1:a=0[outv]")
        steps.append(f"{audio_pads}concat=n={len(paths)}:v=0:a=1[outa]")
    else:
        # Each xfade overlaps the running chain with the next clip, so the
        # chain gets `duration` shorter than a plain concat at every join.
        chain_duration = infos[0].duration
        video_label, audio_label = "v0", "a0"
        for index in range(1, len(paths)):
            offset = max(0.0, chain_duration - duration)
            out_v, out_a = f"vx{index}", f"ax{index}"
            steps.append(
                f"[{video_label}][v{index}]xfade=transition={xfade}"
                f":duration={duration:.4f}:offset={offset:.4f}[{out_v}]")
            steps.append(
                f"[{audio_label}][a{index}]acrossfade=d={duration:.4f}[{out_a}]")
            video_label, audio_label = out_v, out_a
            chain_duration = offset + infos[index].duration
        steps.append(f"[{video_label}]null[outv]")
        steps.append(f"[{audio_label}]anull[outa]")

    parent = os.path.dirname(os.path.abspath(output))
    os.makedirs(parent, exist_ok=True)
    cmd += [
        "-filter_complex", ";".join(steps),
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
        "-pix_fmt", "yuv420p", "-r", str(target_fps),
        "-c:a", "aac", "-b:a", audio_bitrate,
        "-movflags", "+faststart",
        output,
    ]

    if verbose:
        joined = "cuts" if xfade is None else f"{duration:.2f}s {transition}"
        print(f"  Joining {len(paths)} clips with {joined} "
              f"at {target_w}x{target_h} @ {target_fps:.2f} fps ...")

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RenderError(
            f"ffmpeg could not join the clips:\n{proc.stderr.strip()}")
    if not os.path.exists(output):
        raise RenderError(f"ffmpeg reported success but {output!r} is missing.")

    if verbose:
        result = probe_video(output)
        print(f"  Joined -> {result.duration:.1f}s "
              f"({os.path.getsize(output) / (1024 * 1024):.1f} MB)")
    return output


def _read_exact(stream, size: int) -> bytes | None:
    """Read exactly `size` bytes; ffmpeg pipes deliver frames in pieces."""
    buffer = bytearray()
    while len(buffer) < size:
        block = stream.read(size - len(buffer))
        if not block:
            return None
        buffer.extend(block)
    return bytes(buffer)


def _format_eta(seconds: float) -> str:
    if seconds < 0 or seconds != seconds or seconds == float("inf"):
        return "--:--"
    minutes, secs = divmod(int(seconds), 60)
    return f"{minutes:02d}:{secs:02d}"


def render_video(
    input_path: str,
    output_path: str,
    chunks: list[Chunk],
    style: CaptionStyle,
    animation: AnimationStyle | None = None,
    preview_seconds: float | None = None,
    crf: int = 18,
    preset: str = "medium",
    audio_bitrate: str = "192k",
    verbose: bool = True,
) -> str:
    """Burn `chunks` onto `input_path` and write an H.264 MP4 to `output_path`.

    Frames stream through two ffmpeg processes (decode -> compositing ->
    encode), so memory stays flat regardless of clip length.
    """
    ffmpeg, _ = require_ffmpeg()
    info = probe_video(input_path)

    if verbose:
        print(f"  Source: {info.width}x{info.height} @ {info.fps:.2f} fps, "
              f"{info.duration:.1f}s, audio={'yes' if info.has_audio else 'no'}")
        if abs(info.aspect - 9 / 16) > 0.02:
            print(f"  Note: aspect is {info.aspect:.3f}, not 9:16 (0.5625). "
                  f"Captions still render, but crop to 9:16 for Shorts/Reels.")

    animation = animation or AnimationStyle()
    renderer = CaptionRenderer(info.width, info.height, style, animation,
                               fps=info.fps)
    if verbose:
        print(f"  Style: {os.path.basename(renderer.font_path)} @ "
              f"{renderer.font_size}px, stroke {renderer.stroke_width}px, "
              f"{len(chunks)} caption cards")
        if animation.enabled:
            motion = []
            if animation.pop_in:
                motion.append(f"pop-in {animation.pop_in_duration * 1000:.0f}ms "
                              f"from {animation.pop_in_from:.2f}x")
            if animation.word_bounce > 0:
                motion.append(
                    f"word bounce to {renderer.peak_word_scale:.2f}x over "
                    f"{animation.word_bounce_duration * 1000:.0f}ms")
            print(f"  Motion: {', '.join(motion) if motion else 'none'}")
        else:
            print("  Motion: off (static captions)")

    parent = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(parent, exist_ok=True)

    decode_cmd = [ffmpeg, "-hide_banner", "-loglevel", "error"]
    if preview_seconds:
        decode_cmd += ["-t", str(preview_seconds)]
    decode_cmd += ["-i", input_path, "-f", "rawvideo", "-pix_fmt", "rgb24",
                   "-vsync", "0", "-"]

    encode_cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{info.width}x{info.height}", "-r", f"{info.fps}",
        "-i", "-",
    ]
    if info.has_audio:
        if preview_seconds:
            encode_cmd += ["-t", str(preview_seconds)]
        encode_cmd += ["-i", input_path, "-map", "0:v:0", "-map", "1:a:0",
                       "-c:a", "aac", "-b:a", audio_bitrate, "-shortest"]
    encode_cmd += [
        "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        output_path,
    ]

    total = info.frame_count or 0
    if preview_seconds:
        total = int(round(min(info.duration or preview_seconds,
                              preview_seconds) * info.fps))
    frame_bytes = info.width * info.height * 3
    frame_index = 0
    started = time.time()
    chunk_cursor = 0

    decoder = subprocess.Popen(decode_cmd, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, bufsize=frame_bytes)
    encoder = subprocess.Popen(encode_cmd, stdin=subprocess.PIPE,
                               stderr=subprocess.PIPE, bufsize=frame_bytes)
    try:
        while True:
            raw = _read_exact(decoder.stdout, frame_bytes)
            if raw is None:
                break
            timestamp = frame_index / info.fps
            frame = np.frombuffer(raw, dtype=np.uint8).reshape(
                info.height, info.width, 3).copy()

            # Chunks are time-ordered, so walk a cursor forward instead of
            # searching the whole list once per frame.
            while (chunk_cursor < len(chunks)
                   and chunks[chunk_cursor].display_until <= timestamp):
                chunk_cursor += 1
            if chunk_cursor < len(chunks):
                chunk = chunks[chunk_cursor]
                if chunk.start <= timestamp < chunk.display_until:
                    overlay = renderer.overlay_at(chunk_cursor, chunk, timestamp)
                    if overlay is not None:
                        renderer.composite(frame, overlay)

            encoder.stdin.write(frame.tobytes())
            frame_index += 1

            if verbose and frame_index % 30 == 0:
                elapsed = time.time() - started
                rate = frame_index / elapsed if elapsed else 0.0
                if total:
                    pct = 100.0 * frame_index / total
                    eta = (total - frame_index) / rate if rate else 0.0
                    sys.stdout.write(
                        f"\r  Rendering {pct:5.1f}%  "
                        f"({frame_index}/{total} frames, {rate:.1f} fps, "
                        f"ETA {_format_eta(eta)})")
                else:
                    sys.stdout.write(
                        f"\r  Rendering {frame_index} frames ({rate:.1f} fps)")
                sys.stdout.flush()

        if verbose:
            sys.stdout.write("\r" + " " * 72 + "\r")

        encoder.stdin.close()
        decoder_err = decoder.stderr.read().decode("utf-8", "replace").strip()
        decoder.wait()
        encoder_err = encoder.stderr.read().decode("utf-8", "replace").strip()
        encoder.wait()

    except BrokenPipeError as exc:
        encoder_err = encoder.stderr.read().decode("utf-8", "replace").strip()
        raise RenderError(f"ffmpeg encoder stopped early:\n{encoder_err}") from exc
    finally:
        for proc in (decoder, encoder):
            if proc.poll() is None:
                proc.kill()

    if frame_index == 0:
        raise RenderError(
            f"No frames were decoded from {input_path!r}.\n{decoder_err}")
    if encoder.returncode != 0:
        raise RenderError(f"ffmpeg encoding failed:\n{encoder_err}")
    if not os.path.exists(output_path):
        raise RenderError(f"ffmpeg reported success but {output_path!r} is "
                          f"missing.")

    if verbose:
        elapsed = time.time() - started
        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"  Rendered {frame_index} frames in {elapsed:.1f}s "
              f"({frame_index / elapsed:.1f} fps) -> {size_mb:.1f} MB")
    return output_path

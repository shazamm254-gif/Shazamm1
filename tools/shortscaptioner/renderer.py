#!/usr/bin/env python3
"""
renderer.py — chunking, styling and frame compositing for ShortsCaptioner.

Three jobs live here:

1. `chunk_words()` groups the word stream into 2-4 word cards so the screen
   never gets crowded, breaking on pauses and sentence ends.
2. `CaptionRenderer` turns one chunk (plus which word is currently being
   spoken) into a transparent overlay: heavy font, white fill, thick black
   stroke, drop shadow, and the active word swapped to the highlight colour.
3. `render_video()` streams the source video through ffmpeg, composites the
   overlay onto each frame, and pipes the result back out to an H.264 MP4
   with the original audio re-attached.

Overlays are cached by (chunk index, active word index), so a 60-second clip
draws a few hundred overlays rather than 1800 — the compositing per frame is
then just an alpha blend over a small bounding box.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field

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

    def __init__(self, width: int, height: int, style: CaptionStyle):
        self.width = width
        self.height = height
        self.style = style

        self.font_size = style.resolved_font_size(width, height)
        self.stroke_width = style.resolved_stroke_width(self.font_size)
        self.font = load_font(style.font_path, self.font_size)
        self.font_path = find_font(style.font_path)

        self._font_cache: dict[int, ImageFont.FreeTypeFont] = {
            self.font_size: self.font
        }
        self._overlay_cache: dict[tuple[int, int], Overlay | None] = {}
        self._measure = ImageDraw.Draw(Image.new("RGBA", (1, 1)))

        self.ascent, self.descent = self.font.getmetrics()
        self.line_height = self.ascent + self.descent
        self.line_gap = int(round(self.line_height * style.line_spacing))
        self.space_width = self._measure.textlength(
            " ", font=self.font) * style.word_spacing
        # Wrapping happens on painted width, so reserve room for the stroke.
        self.max_text_width = (width * style.max_width_ratio
                               - self.stroke_width * 2)

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
        # word visually collides with the one beside it.
        grow = max(0.0, self.style.pop_scale - 1.0) / 2.0

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

    def render_overlay(self, chunk: Chunk, active_index: int) -> Overlay | None:
        """Build the RGBA overlay for one chunk with one word highlighted."""
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

        if style.shadow:
            shadow = Image.new("RGBA", size, (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow)
            offset = self.font_size * style.shadow_offset_ratio
            alpha = int(255 * style.shadow_opacity)
            for index, word in enumerate(flat):
                scale = (style.pop_scale
                         if index == active and style.pop_scale != 1.0 else 1.0)
                ghost = _PlacedWord(word.text, word.x,
                                    word.baseline + offset, word.width)
                self._draw_word(shadow_draw, ghost, (0, 0, 0, alpha),
                                (0, 0, 0, alpha), self.stroke_width, scale)
            blur = self.font_size * style.shadow_blur_ratio
            if blur > 0:
                shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
            layer = Image.alpha_composite(layer, shadow)

        draw = ImageDraw.Draw(layer)
        if use_box and flat:
            word = flat[active]
            scale = style.pop_scale if style.pop_scale != 1.0 else 1.0
            self._draw_highlight_box(draw, word, scale)

        for index, word in enumerate(flat):
            is_active = index == active
            scale = style.pop_scale if is_active and style.pop_scale != 1.0 else 1.0
            if is_active and use_box and not use_color:
                fill = style.box_text_color
            elif is_active and use_color:
                fill = style.highlight_color
            else:
                fill = style.text_color
            self._draw_word(draw, word, fill, style.stroke_color,
                            self.stroke_width, scale)

        array = np.asarray(layer, dtype=np.uint8)
        return Overlay(
            rgb=np.ascontiguousarray(array[:, :, :3]),
            alpha=np.ascontiguousarray(
                array[:, :, 3:4].astype(np.float32) / 255.0),
            x=x0,
            y=y0,
        )

    def overlay_for(self, chunk_index: int, chunk: Chunk,
                    active_index: int) -> Overlay | None:
        """Cached `render_overlay` — the same card+word repeats for many frames."""
        key = (chunk_index, active_index)
        if key not in self._overlay_cache:
            self._overlay_cache[key] = self.render_overlay(chunk, active_index)
        return self._overlay_cache[key]

    @staticmethod
    def composite(frame: np.ndarray, overlay: Overlay) -> np.ndarray:
        """Alpha-blend an overlay onto an RGB frame, in place, over its box."""
        h, w = overlay.rgb.shape[:2]
        y0, x0 = overlay.y, overlay.x
        y1, x1 = min(frame.shape[0], y0 + h), min(frame.shape[1], x0 + w)
        if y1 <= y0 or x1 <= x0:
            return frame
        region = frame[y0:y1, x0:x1].astype(np.float32)
        rgb = overlay.rgb[:y1 - y0, :x1 - x0].astype(np.float32)
        alpha = overlay.alpha[:y1 - y0, :x1 - x0]
        frame[y0:y1, x0:x1] = (region * (1.0 - alpha) + rgb * alpha).astype(
            np.uint8)
        return frame

    def render_still(self, chunk: Chunk, active_index: int,
                     background: np.ndarray | None = None) -> Image.Image:
        """One composited frame as a PIL image — handy for style previews."""
        if background is None:
            background = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        frame = background.copy()
        overlay = self.render_overlay(chunk, active_index)
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

    renderer = CaptionRenderer(info.width, info.height, style)
    if verbose:
        print(f"  Style: {os.path.basename(renderer.font_path)} @ "
              f"{renderer.font_size}px, stroke {renderer.stroke_width}px, "
              f"{len(chunks)} caption cards")

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
                    overlay = renderer.overlay_for(
                        chunk_cursor, chunk, chunk.active_index(timestamp))
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

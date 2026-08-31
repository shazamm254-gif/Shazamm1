import base64
import re
from abc import ABC, abstractmethod

from PIL import Image, ImageDraw, ImageFilter

NAMED_COLORS = {
    "navy": "#14304F", "money green": "#2F9E5C", "green": "#2F9E5C",
    "gold": "#C9A227", "alert red": "#C0392B", "red": "#C0392B",
    "charcoal": "#2B2F33", "cream": "#EFE9D8", "white": "#F2F2EE",
    "teal": "#2F6E6A", "amber": "#C9622B", "orange": "#C9622B",
    "grey": "#5A636B", "gray": "#5A636B", "black": "#1A1A1A",
    "blue": "#3D6C95", "purple": "#4B2E5A", "magenta": "#B23A78",
    "brown": "#5A3A2F", "beige": "#E8DCC0", "silver": "#B7BAC0",
    "burgundy": "#5C1F2E", "yellow": "#D4B830",
}

HEX_RE = re.compile(r"#[0-9A-Fa-f]{6}")


class ImageProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, out_path: str, width: int, height: int,
                 context: dict = None) -> str:
        """
        Write an image to out_path and return it.

        `context` describes which slot is being filled, so providers that
        source images rather than generate them know what to look up:
          {"rank": int, "slug": str, "index": int, "is_thumbnail": bool}
        Generative providers ignore it.
        """


def _extract_palette(palette_text, fallback_count=3):
    hexes = HEX_RE.findall(palette_text)
    if len(hexes) < 2:
        lowered = palette_text.lower()
        for name, hexcode in NAMED_COLORS.items():
            if name in lowered and hexcode not in hexes:
                hexes.append(hexcode)
    if not hexes:
        hexes = ["#14304F", "#C9A227", "#2B2F33"]
    while len(hexes) < fallback_count:
        hexes.append(hexes[-1])
    return hexes[:fallback_count]


class PlaceholderImageProvider(ImageProvider):
    """
    Zero-API-key fallback: renders an abstract, palette-matched gradient
    with a few geometric accents so the pipeline is fully testable (and
    still looks like a deliberate minimalist background, not a debug
    placeholder) before you wire in a real image model.
    """

    def generate(self, prompt, out_path, width, height, context=None):
        colors = _extract_palette(prompt)
        c1 = Image.new("RGB", (1, 1), colors[0]).getpixel((0, 0))
        c2 = Image.new("RGB", (1, 1), colors[1]).getpixel((0, 0))

        img = Image.new("RGB", (width, height))
        px = img.load()
        for y in range(height):
            t = y / height
            r = int(c1[0] * (1 - t) + c2[0] * t)
            g = int(c1[1] * (1 - t) + c2[1] * t)
            b = int(c1[2] * (1 - t) + c2[2] * t)
            for x in range(width):
                px[x, y] = (r, g, b)

        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        accent = colors[2] if len(colors) > 2 else colors[0]
        seed = sum(ord(c) for c in prompt) % 997
        for i in range(3):
            cx = (seed * (i + 3)) % width
            cy = (seed * (i + 5)) % height
            r = 120 + (seed * (i + 1)) % 260
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=accent, width=6)

        img = Image.alpha_composite(img.convert("RGBA"), overlay)
        img = img.filter(ImageFilter.GaussianBlur(1))
        img.convert("RGB").save(out_path, quality=92)
        return out_path


class OpenAIImageProvider(ImageProvider):
    def __init__(self, api_key, model):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def generate(self, prompt, out_path, width, height, context=None):
        size = "1024x1536" if height >= width else "1536x1024"
        result = self.client.images.generate(
            model=self.model, prompt=prompt, size=size, n=1
        )
        image_b64 = result.data[0].b64_json
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(image_b64))
        img = Image.open(out_path).convert("RGB")
        img = img.resize((width, height))
        img.save(out_path, quality=95)
        return out_path


class LocalImageProvider(ImageProvider):
    """
    Uses your own images instead of generating any.

    Expected layout under --image-dir, one folder per video:

        my_images/
          01_why_the_milk_is_always_at_the_back_of_the_store/
            shot_00.jpg      <- pairs with narration line 1
            shot_01.jpg      <- line 2
            ...
            shot_08.jpg      <- line 9
            thumb.jpg        <- optional; falls back to shot_00
          02_the_ikea_maze_the_one_way_path_you_can_t_leave/
            ...

    Folder names are exactly the "<rank>_<slug>" the pipeline already uses
    for build folders and output filenames -- run list_shots.py to create
    the whole empty skeleton with a manifest of what belongs in each slot.

    Any common format works (jpg, jpeg, png, webp, bmp, tif) and any
    resolution or aspect ratio; images are fitted to 1080x1920 during
    assembly. A shot with no file is a hard error naming the exact missing
    path, unless `fallback` is set -- silent substitution is exactly the
    failure you would not notice until the video was published.
    """

    EXTS = ("jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff",
            "JPG", "JPEG", "PNG", "WEBP")

    def __init__(self, image_dir, fallback=None):
        self.image_dir = image_dir
        self.fallback = fallback

    def _find(self, folder, stem):
        import glob
        import os
        for ext in self.EXTS:
            hits = sorted(glob.glob(os.path.join(folder, f"{stem}.{ext}")))
            if hits:
                return hits[0]
        return None

    def generate(self, prompt, out_path, width, height, context=None):
        import os
        import shutil

        if context is None:
            raise RuntimeError(
                "LocalImageProvider needs shot context. Update assemble.py to pass it."
            )

        folder_name = f"{context['rank']:02d}_{context['slug']}"
        folder = os.path.join(self.image_dir, folder_name)

        if context.get("is_thumbnail"):
            src = self._find(folder, "thumb") or self._find(folder, "shot_00")
            missing_desc = f"{folder}/thumb.<ext> (or shot_00.<ext> as fallback)"
        else:
            src = self._find(folder, f"shot_{context['index']:02d}")
            missing_desc = f"{folder}/shot_{context['index']:02d}.<ext>"

        if src is None:
            if self.fallback is not None:
                return self.fallback.generate(prompt, out_path, width, height, context)
            raise FileNotFoundError(
                f"No image found for {missing_desc}\n"
                f"  This slot's shot description was: {prompt[:160]}...\n"
                f"  Add the file, or pass --allow-missing-images to fill gaps with "
                f"placeholder art."
            )

        # Copy rather than move, so a source library is never consumed by a
        # render. Re-encode through PIL so an odd input format or a CMYK /
        # palette-mode file cannot break ffmpeg later.
        img = Image.open(src)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.save(out_path)
        return out_path


def get_image_provider(name, config, image_dir=None, allow_missing=False):
    if name == "openai":
        if not config.OPENAI_API_KEY:
            raise RuntimeError("IMAGE_PROVIDER=openai requires OPENAI_API_KEY")
        return OpenAIImageProvider(config.OPENAI_API_KEY, config.OPENAI_IMAGE_MODEL)
    if name == "local":
        directory = image_dir or config.IMAGE_DIR
        if not directory:
            raise RuntimeError(
                "IMAGE_PROVIDER=local requires --image-dir (or IMAGE_DIR in .env)"
            )
        return LocalImageProvider(
            directory,
            fallback=PlaceholderImageProvider() if allow_missing else None,
        )
    return PlaceholderImageProvider()

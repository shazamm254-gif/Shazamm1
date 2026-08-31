import os
import shutil

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# Candidate font locations, in preference order. The pipeline runs on
# desktop Linux, macOS, and Termux on Android, and none of them agree on
# where fonts live -- Termux in particular ships no fonts at all by
# default, so a hardcoded Debian path made every render crash there.
_FONT_CANDIDATES = {
    "bold": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",       # Debian/Ubuntu
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/data/data/com.termux/files/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "/data/data/com.termux/files/usr/share/fonts/DejaVuSans-Bold.ttf",
        "/system/fonts/Roboto-Bold.ttf",                              # Android system
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",          # macOS
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",                   # Arch
    ],
    "regular": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/data/data/com.termux/files/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/data/data/com.termux/files/usr/share/fonts/DejaVuSans.ttf",
        "/system/fonts/Roboto-Regular.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ],
}


def _find_font(kind, override=None):
    """
    Return a usable font path, or None to signal "use Pillow's built-in".

    An explicit override (FONT_BOLD / FONT_REGULAR env var) wins, and is
    reported loudly if it is wrong rather than silently ignored -- a
    missing font you asked for is a mistake worth hearing about.
    """
    if override:
        if os.path.isfile(override):
            return override
        print(f"[config] WARNING: font not found at {override!r}; falling back to a system font.")
    for path in _FONT_CANDIDATES[kind]:
        if os.path.isfile(path):
            return path
    # Last resort: bundled copy shipped alongside the pipeline, if present.
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    name = "DejaVuSans-Bold.ttf" if kind == "bold" else "DejaVuSans.ttf"
    bundled = os.path.join(here, "assets", "fonts", name)
    if os.path.isfile(bundled):
        return bundled
    return None


class Config:
    IMAGE_PROVIDER = os.environ.get("IMAGE_PROVIDER", "placeholder")
    TTS_PROVIDER = os.environ.get("TTS_PROVIDER", "espeak")
    IMAGE_DIR = os.environ.get("IMAGE_DIR")          # for IMAGE_PROVIDER=local
    FIT_MODE = os.environ.get("FIT_MODE", "cover")   # cover | contain

    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    OPENAI_IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
    OPENAI_TTS_MODEL = os.environ.get("OPENAI_TTS_MODEL", "tts-1")
    OPENAI_TTS_VOICE = os.environ.get("OPENAI_TTS_VOICE", "onyx")

    ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
    ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "")

    WIDTH = int(os.environ.get("WIDTH", 1080))
    HEIGHT = int(os.environ.get("HEIGHT", 1920))
    FPS = int(os.environ.get("FPS", 25))

    ZOOM_PER_FRAME = 0.0015
    MAX_ZOOM = 1.18

    # How far the source is upscaled before the Ken Burns zoom samples from
    # it. Higher is marginally smoother but costs real time: measured at
    # 6.6s vs 2.8s for one 6s clip going from 2.0 to 1.0 on a 4-core x86
    # box. At our modest zoom range (max 1.18x) the visible difference is
    # slight, so 1.5 is the default and phones should use 1.0.
    SUPERSAMPLE = float(os.environ.get("SUPERSAMPLE", 1.5))

    MIN_SEGMENT_SECONDS = 3.0

    # Delete each video's intermediate build folder once it is muxed.
    # Intermediates run roughly 70MB per video, which is fine on a laptop
    # and not fine on a phone rendering fifty of them.
    KEEP_BUILD = os.environ.get("KEEP_BUILD", "").lower() in ("1", "true", "yes")

    FONT_BOLD = _find_font("bold", os.environ.get("FONT_BOLD"))
    FONT_REGULAR = _find_font("regular", os.environ.get("FONT_REGULAR"))

    @staticmethod
    def check_dependencies():
        """Fail early and clearly if ffmpeg is missing, rather than deep in a render."""
        missing = [b for b in ("ffmpeg", "ffprobe") if shutil.which(b) is None]
        if missing:
            raise RuntimeError(
                f"Required binary not found on PATH: {', '.join(missing)}\n"
                f"  Debian/Ubuntu: apt install ffmpeg\n"
                f"  Termux:        pkg install ffmpeg\n"
                f"  macOS:         brew install ffmpeg"
            )

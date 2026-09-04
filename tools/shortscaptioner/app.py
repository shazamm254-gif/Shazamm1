#!/usr/bin/env python3
"""
app.py — ShortsCaptioner: burn viral-style animated captions onto a 9:16 video.

Transcribes the video locally with faster-whisper (word-level timestamps),
groups the words into 2-4 word cards, and renders them in a heavy font with a
thick black outline, a drop shadow, and the currently spoken word swapped to a
highlight colour — the karaoke look used across Shorts, Reels and TikTok.
Cards spring in, active words bounce, and several clips can be joined with a
transition first.

Quick start:
    python app.py --input clip.mp4 --font fonts/Montserrat-Black.ttf \
                  --highlight-color "#FFDE59" --output captioned.mp4

Iterate on the style without paying for transcription twice:
    python app.py -i clip.mp4 -f Montserrat-Black.ttf --transcript clip.json \
                  --preset neon --preview 8 -o test.mp4

Judge the motion in a second, without an encode:
    python app.py -f Montserrat-Black.ttf --still motion.png --still-frames 6

Cut several takes together and caption them as one timeline:
    python app.py -i hook.mp4 body.mp4 -f Anton-Regular.ttf \
                  --transition crossfade -o final.mp4

See STYLE_PRESETS below for the built-in looks, and --list-fonts to find out
which fonts this machine can already use.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from renderer import (  # noqa: E402
    TRANSITIONS, AnimationStyle, CaptionRenderer, CaptionStyle,
    FontNotFoundError, RenderError, available_fonts, chunk_words, concat_clips,
    find_font, parse_color, probe_video, render_video,
)
from whisper_helper import (  # noqa: E402
    TranscriptionError, save_words, transcribe_words,
)

# Style presets, including how much motion each look carries. Anything the user
# passes explicitly wins over these.
STYLE_PRESETS = {
    "hormozi": {
        "highlight_color": "#FFDE59", "highlight_style": "color",
        "pop_scale": 1.12, "position": 0.55, "max_words": 3,
        "word_bounce": 0.08, "pop_in_from": 0.72,
    },
    "neon": {
        "highlight_color": "#39FF14", "highlight_style": "color",
        "pop_scale": 1.15, "position": 0.55, "max_words": 3,
        "word_bounce": 0.11, "pop_in_from": 0.62,
    },
    "boxed": {
        "highlight_color": "#39FF14", "highlight_style": "box",
        "pop_scale": 1.06, "position": 0.55, "max_words": 3,
        "word_bounce": 0.06, "pop_in_from": 0.80,
    },
    "clean": {
        "highlight_color": "#FFFFFF", "highlight_style": "color",
        "pop_scale": 1.0, "position": 0.62, "max_words": 4,
        "word_bounce": 0.0, "pop_in_from": 0.88,
    },
}

# Fonts worth having in fonts/ — all free, all heavy enough to read on mobile.
SUGGESTED_FONTS = [
    "Montserrat-Black.ttf", "BebasNeue-Regular.ttf", "Anton-Regular.ttf",
    "Impact.ttf", "Oswald-Bold.ttf", "Poppins-ExtraBold.ttf",
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="shortscaptioner",
        description="Burn viral-style animated captions onto a 9:16 video.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python app.py -i clip.mp4 -f Montserrat-Black.ttf -o out.mp4\n"
            "  python app.py -i clip.mp4 -f BebasNeue-Regular.ttf "
            "--highlight-color neon --preset boxed -o out.mp4\n"
            "  python app.py -i a.mp4 b.mp4 -f Anton-Regular.ttf "
            "--transition crossfade -o out.mp4\n"
            "  python app.py -f Anton-Regular.ttf --still motion.png "
            "--still-frames 6\n"
            "  python app.py --list-fonts\n"
        ),
    )

    core = parser.add_argument_group("core")
    core.add_argument("--input", "-i", nargs="+", metavar="VIDEO",
                      help="Input video (vertical 9:16 MP4). Pass several and "
                           "they are joined with --transition first, then "
                           "captioned as one timeline.")
    core.add_argument("--output", "-o", default=None,
                      help="Output MP4. Default: <input>-captioned.mp4")
    core.add_argument("--font", "-f", default="Montserrat-Black.ttf",
                      help="TrueType font file, name, or family stem. "
                           "Default: Montserrat-Black.ttf")
    core.add_argument("--highlight-color", default=None,
                      help="Active-word colour: #FFDE59, 'neon', or 'R,G,B'.")
    core.add_argument("--preset", choices=sorted(STYLE_PRESETS), default=None,
                      help="Start from a built-in look, then override it.")

    style = parser.add_argument_group("style")
    style.add_argument("--text-color", default="#FFFFFF",
                       help="Colour of inactive words. Default: white.")
    style.add_argument("--stroke-color", default="#000000",
                       help="Outline colour. Default: black.")
    style.add_argument("--stroke-width", type=int, default=0,
                       help="Outline thickness in px. Default: auto (~4-5px "
                            "at 1080p).")
    style.add_argument("--font-size", type=int, default=0,
                       help="Font size in px. Default: auto (~9.5%% of width).")
    style.add_argument("--highlight-style", choices=("color", "box", "both"),
                       default=None,
                       help="Recolour the active word, put it in a filled box, "
                            "or both. Default: color.")
    style.add_argument("--pop-scale", type=float, default=None,
                       help="How much the active word grows, e.g. 1.12. "
                            "Use 1.0 for no pop.")
    style.add_argument("--position", type=float, default=None,
                       help="Vertical centre as a fraction of height "
                            "(0.5 = dead centre). Default: 0.55.")
    style.add_argument("--max-width", type=float, default=0.86,
                       help="Max text width as a fraction of frame width.")
    style.add_argument("--no-uppercase", action="store_true",
                       help="Keep the original casing instead of SHOUTING.")
    style.add_argument("--keep-punctuation", action="store_true",
                       help="Keep commas and periods on screen.")
    style.add_argument("--no-shadow", action="store_true",
                       help="Turn off the drop shadow.")

    motion = parser.add_argument_group("motion")
    motion.add_argument("--no-animation", action="store_true",
                        help="Render static captions — no pop-in, no bounce.")
    motion.add_argument("--no-pop-in", action="store_true",
                        help="Cards appear instantly instead of scaling up.")
    motion.add_argument("--pop-in-duration", type=float, default=0.18,
                        help="Seconds for a new card to spring to full size. "
                             "Default: 0.18.")
    motion.add_argument("--pop-in-from", type=float, default=None,
                        help="Scale a card starts at, e.g. 0.72. Lower is a "
                             "bigger entrance.")
    motion.add_argument("--no-pop-in-fade", action="store_true",
                        help="Scale cards in without also fading them in.")
    motion.add_argument("--word-bounce", type=float, default=None,
                        help="Extra scale kicked onto a word the moment it "
                             "goes active, on top of --pop-scale. 0 disables.")
    motion.add_argument("--word-bounce-duration", type=float, default=0.13,
                        help="Seconds for that kick to settle. Default: 0.13.")

    clips = parser.add_argument_group("clips")
    clips.add_argument("--transition", choices=sorted(TRANSITIONS),
                       default="crossfade",
                       help="How to join multiple --input clips. Default: "
                            "crossfade. 'cut' is a hard cut.")
    clips.add_argument("--transition-duration", type=float, default=0.5,
                       help="Transition length in seconds. Default: 0.5. "
                            "Ignored for 'cut'.")
    clips.add_argument("--keep-joined", action="store_true",
                       help="Keep the joined-but-uncaptioned video next to the "
                            "output instead of deleting it.")

    chunking = parser.add_argument_group("chunking")
    chunking.add_argument("--max-words", type=int, default=None,
                          help="Max words per caption card. Default: 3.")
    chunking.add_argument("--min-words", type=int, default=2,
                          help="Avoid trailing cards shorter than this.")
    chunking.add_argument("--max-chars", type=int, default=22,
                          help="Break a card once it exceeds this many chars.")
    chunking.add_argument("--gap", type=float, default=0.45,
                          help="Pause (seconds) that forces a new card.")

    whisper = parser.add_argument_group("transcription")
    whisper.add_argument("--model", default="base",
                         help="Whisper size: tiny, base, small, medium, "
                              "large-v3. Default: base.")
    whisper.add_argument("--device", default="auto",
                         help="auto, cpu, or cuda. Default: auto.")
    whisper.add_argument("--compute-type", default=None,
                         help="int8, float16, float32. Default: picked from "
                              "the device.")
    whisper.add_argument("--language", default=None,
                         help="Force a language code, e.g. en. Default: "
                              "auto-detect.")
    whisper.add_argument("--no-vad", action="store_true",
                         help="Disable voice-activity filtering.")
    whisper.add_argument("--transcript", default=None,
                         help="JSON transcript to load if present, else write "
                              "after transcribing. Makes restyling instant.")

    output = parser.add_argument_group("output")
    output.add_argument("--preview", type=float, default=None,
                        help="Only render the first N seconds — use this while "
                             "dialling in a style.")
    output.add_argument("--crf", type=int, default=18,
                        help="x264 quality, lower is better. Default: 18.")
    output.add_argument("--preset-x264", default="medium",
                        help="x264 speed preset. Default: medium.")
    output.add_argument("--still", default=None,
                        help="Write a styled PNG preview here and exit "
                             "(no video render, no ffmpeg encode).")
    output.add_argument("--still-frames", type=int, default=1, metavar="N",
                        help="Make --still a contact sheet of N frames across "
                             "the animation instead of one settled frame — the "
                             "fastest way to check the motion.")
    output.add_argument("--quiet", "-q", action="store_true",
                        help="Only print errors.")

    parser.add_argument("--list-fonts", action="store_true",
                        help="List usable font files and exit.")
    return parser


def resolve_style(args) -> tuple[CaptionStyle, int]:
    """Merge preset defaults with explicit flags into a CaptionStyle."""
    preset = STYLE_PRESETS.get(args.preset, STYLE_PRESETS["hormozi"])

    highlight = args.highlight_color or preset["highlight_color"]
    highlight_style = args.highlight_style or preset["highlight_style"]
    pop_scale = (preset["pop_scale"] if args.pop_scale is None
                 else args.pop_scale)
    position = preset["position"] if args.position is None else args.position
    max_words = preset["max_words"] if args.max_words is None else args.max_words

    style = CaptionStyle(
        font_path=args.font,
        font_size=args.font_size,
        text_color=parse_color(args.text_color),
        highlight_color=parse_color(highlight),
        stroke_color=parse_color(args.stroke_color),
        stroke_width=args.stroke_width,
        highlight_style=highlight_style,
        shadow=not args.no_shadow,
        position=position,
        max_width_ratio=args.max_width,
        uppercase=not args.no_uppercase,
        keep_punctuation=args.keep_punctuation,
        pop_scale=pop_scale,
    )
    return style, max_words


def resolve_animation(args) -> AnimationStyle:
    """Merge preset motion defaults with explicit flags."""
    preset = STYLE_PRESETS.get(args.preset, STYLE_PRESETS["hormozi"])
    bounce = (preset["word_bounce"] if args.word_bounce is None
              else args.word_bounce)
    pop_from = (preset["pop_in_from"] if args.pop_in_from is None
                else args.pop_in_from)
    return AnimationStyle(
        enabled=not args.no_animation,
        pop_in=not args.no_pop_in,
        pop_in_duration=max(0.0, args.pop_in_duration),
        pop_in_from=max(0.01, pop_from),
        pop_in_fade=not args.no_pop_in_fade,
        word_bounce=max(0.0, bounce),
        word_bounce_duration=max(0.01, args.word_bounce_duration),
    )


def write_still(args, style: CaptionStyle, animation: AnimationStyle) -> int:
    """Render a caption card to a PNG so a style can be checked in a second.

    With --still-frames N this becomes a contact sheet sampling the card's
    first moments, which is how you actually judge the motion without waiting
    on a video encode.
    """
    from whisper_helper import Word

    if args.input and os.path.exists(args.input[0]):
        info = probe_video(args.input[0])
        width, height = info.width, info.height
    else:
        width, height = 1080, 1920

    demo = [Word("THIS", 0.0, 0.3), Word("CHANGES", 0.3, 0.7),
            Word("EVERYTHING", 0.7, 1.2)]
    chunk = chunk_words(demo, max_words=3)[0]
    renderer = CaptionRenderer(width, height, style, animation)

    # A mid-grey gradient, not black: the point of a preview is to show whether
    # the outline and shadow actually separate the text from a busy background.
    ramp = np.linspace(60, 190, height, dtype=np.uint8)
    background = np.repeat(ramp[:, None], width, axis=1)[:, :, None]
    background = np.repeat(background, 3, axis=2)

    frames = max(1, args.still_frames)
    if frames == 1:
        image = renderer.render_still(chunk, active_index=1,
                                      background=background)
    else:
        # Sample across the pop-in and a little past it, so the sheet shows the
        # entrance settling rather than only its first instant.
        span = max(animation.pop_in_duration, animation.word_bounce_duration)
        times = [chunk.start + span * 1.25 * i / (frames - 1)
                 for i in range(frames)]
        tiles = [renderer.render_still(chunk, active_index=0,
                                       background=background, t=t)
                 for t in times]
        # Crop each tile to the caption band; a full 1920-tall column per frame
        # would make the sheet unreadable.
        band = int(height * 0.22)
        top = max(0, int(height * style.position - band / 2))
        tiles = [tile.crop((0, top, width, min(height, top + band)))
                 for tile in tiles]
        image = Image.new("RGB", (width, tiles[0].height * frames))
        for index, tile in enumerate(tiles):
            image.paste(tile, (0, tile.height * index))

    parent = os.path.dirname(os.path.abspath(args.still))
    os.makedirs(parent, exist_ok=True)
    image.save(args.still)
    if not args.quiet:
        detail = (f"{frames} animation frames" if frames > 1
                  else f"{width}x{height}")
        print(f"Wrote style preview -> {args.still} ({detail}, "
              f"{renderer.font_size}px, stroke {renderer.stroke_width}px, "
              f"peak word scale {renderer.peak_word_scale:.2f}x)")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    verbose = not args.quiet

    if args.list_fonts:
        fonts = available_fonts()
        if not fonts:
            print("No font files found. Download a heavy TTF (Montserrat "
                  "Black, Bebas Neue, Anton) and drop it in "
                  f"{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')}/")
            return 1
        print(f"{len(fonts)} font files visible:")
        for path in fonts:
            print(f"  {path}")
        return 0

    # Resolve the font before anything expensive runs — a typo here should
    # fail in a second, not after a three-minute transcription.
    try:
        font_path = find_font(args.font)
    except FontNotFoundError as err:
        print(f"Error: {err}", file=sys.stderr)
        print("\nSuggested downloads (Google Fonts, free):", file=sys.stderr)
        for name in SUGGESTED_FONTS:
            print(f"    {name}", file=sys.stderr)
        return 2

    try:
        style, max_words = resolve_style(args)
    except ValueError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 2
    style.font_path = font_path
    animation = resolve_animation(args)

    if args.still:
        try:
            return write_still(args, style, animation)
        except (FontNotFoundError, RenderError) as err:
            print(f"Error: {err}", file=sys.stderr)
            return 2

    if not args.input:
        parser.error("--input is required (or use --list-fonts / --still).")
    missing = [path for path in args.input if not os.path.exists(path)]
    if missing:
        for path in missing:
            print(f"Error: input video not found: {path}", file=sys.stderr)
        return 2

    output = args.output
    if not output:
        stem, _ = os.path.splitext(args.input[0])
        output = f"{stem}-captioned.mp4"
    outputs = {os.path.abspath(output)}
    if outputs & {os.path.abspath(path) for path in args.input}:
        print("Error: --output would overwrite an input video.", file=sys.stderr)
        return 2

    # Multiple clips get joined first so the transcript covers one continuous
    # timeline — captioning each clip separately would restart word timings at
    # every cut and lose any sentence that straddles one.
    source = args.input[0]
    scratch = None
    steps = 4 if len(args.input) > 1 else 3
    step = 0

    try:
        if verbose:
            print("ShortsCaptioner")
            print(f"  Input : {', '.join(args.input)}")
            print(f"  Output: {output}")
            print(f"  Font  : {font_path}")

        if len(args.input) > 1:
            step += 1
            if verbose:
                print(f"\n[{step}/{steps}] Joining clips")
            if args.keep_joined:
                stem, _ = os.path.splitext(output)
                joined = f"{stem}-joined.mp4"
            else:
                scratch = tempfile.mkdtemp(prefix="shortscaptioner_")
                joined = os.path.join(scratch, "joined.mp4")
            source = concat_clips(
                args.input, joined,
                transition=args.transition,
                duration=args.transition_duration,
                crf=args.crf, preset=args.preset_x264, verbose=verbose,
            )
            if args.keep_joined and verbose:
                print(f"  Kept joined source -> {joined}")

        step += 1
        if verbose:
            print(f"\n[{step}/{steps}] Transcribing")

        words = transcribe_words(
            source,
            model_size=args.model,
            device=args.device,
            compute_type=args.compute_type,
            language=args.language,
            vad_filter=not args.no_vad,
            cache_path=args.transcript,
            verbose=verbose,
        )

        step += 1
        if verbose:
            print(f"\n[{step}/{steps}] Chunking")
        chunks = chunk_words(
            words,
            max_words=max_words,
            min_words=args.min_words,
            max_chars=args.max_chars,
            gap_threshold=args.gap,
        )
        if not chunks:
            print("Error: no caption cards were produced from the transcript.",
                  file=sys.stderr)
            return 1
        if verbose:
            average = sum(len(c.words) for c in chunks) / len(chunks)
            print(f"  {len(chunks)} cards, {average:.1f} words each")
            for chunk in chunks[:3]:
                preview = " ".join(w.text.strip() for w in chunk.words)
                print(f"    {chunk.start:6.2f}s  {preview}")

        step += 1
        if verbose:
            print(f"\n[{step}/{steps}] Rendering")
        render_video(
            source, output, chunks, style,
            animation=animation,
            preview_seconds=args.preview,
            crf=args.crf,
            preset=args.preset_x264,
            verbose=verbose,
        )

        # Keep the transcript around even when the user didn't ask for a cache
        # path but did ask for a preview — the next pass is then free.
        if args.transcript and not os.path.exists(args.transcript):
            save_words(words, args.transcript)

    except FontNotFoundError as err:
        print(f"\nFont error: {err}", file=sys.stderr)
        return 2
    except TranscriptionError as err:
        print(f"\nTranscription error: {err}", file=sys.stderr)
        return 3
    except RenderError as err:
        print(f"\nRender error: {err}", file=sys.stderr)
        return 4
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130
    finally:
        if scratch:
            shutil.rmtree(scratch, ignore_errors=True)

    if verbose:
        print(f"\nDone -> {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

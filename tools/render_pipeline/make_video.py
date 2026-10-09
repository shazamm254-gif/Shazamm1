#!/usr/bin/env python3
"""
Build one video from images and a voiceover you already have.

No spreadsheet, no script generation, no TTS. Point it at a folder of
images and an audio file and it produces the finished vertical video.

  python3 make_video.py --images ./my_shots --voiceover vo.mp3 --out video.mp4

Images are used in filename order, so name them so they sort correctly
(shot_00.jpg, shot_01.jpg, ... or 01.png, 02.png, ...). Any common format
and any aspect ratio works.

Captions are optional. Supply a text file with one caption per line and
they are matched to the images in order:

  python3 make_video.py --images ./my_shots --voiceover vo.mp3 \\
      --captions script.txt --out video.mp4

TIMING: the voiceover's real length is measured and divided across the
images. With captions, each image is weighted by its caption's word count,
so a long line holds longer than a short one -- which tracks a natural
read closely. Without captions, images get equal time. Either way the
video is exactly as long as your audio.

If your caption lines do NOT match what the voiceover actually says, use
--no-captions and burn text on later in an editor; mismatched captions are
worse than none.
"""

import argparse
import glob
import os
import shutil
import subprocess
import sys
import tempfile

from pipeline.assemble import (SHORTS_SAFE, concat_segments, ffprobe_duration,
                               fit_image_to_canvas, ken_burns_segment,
                               measure_loudness, mux_audio, overlay_caption,
                               peak_zoom, render_caption_png, write_shot_list)
from pipeline.config import Config

IMAGE_EXTS = ("jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff",
              "JPG", "JPEG", "PNG", "WEBP")
AUDIO_EXTS = (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".mp4")

# A repeating camera-move pattern that avoids three identical moves in a
# row. Override with --motions.
DEFAULT_MOTION_CYCLE = [
    "push_in", "pan_left_right", "push_in", "pull_out",
    "static_drift", "push_in", "pan_right_left", "pull_out",
]



def enforce_min_duration(durations, total, minimum):
    """
    Stop any shot from flashing past too quickly.

    A caption of three words would otherwise get under a second of screen
    time, which reads as a glitch rather than a cut. Short shots are raised
    to the minimum and the time is taken proportionally from the shots that
    have room to give, so the total still matches the voiceover exactly.

    If there are so many images that even the minimum will not fit, the
    minimum is impossible -- say so and split evenly instead of silently
    producing something wrong.
    """
    n = len(durations)
    if n == 0:
        return durations
    if minimum <= 0:
        return durations
    if n * minimum > total + 1e-6:
        even = total / n
        print(f"NOTE: {n} images into {total:.1f}s cannot all reach the {minimum:.1f}s minimum "
              f"(would need {n * minimum:.1f}s). Splitting evenly at {even:.1f}s each instead.")
        return [even] * n

    out = list(durations)
    for _ in range(50):  # converges quickly; bounded so it can never spin
        deficit = sum(minimum - d for d in out if d < minimum)
        if deficit <= 1e-6:
            break
        donors = [i for i, d in enumerate(out) if d > minimum]
        spare = sum(out[i] - minimum for i in donors)
        if spare <= 1e-6:
            break
        for i in donors:
            out[i] -= deficit * ((out[i] - minimum) / spare)
        for i, d in enumerate(out):
            if d < minimum:
                out[i] = minimum

    # Correct any floating-point drift so the sum is exactly the audio length.
    scale = total / sum(out)
    return [d * scale for d in out]



def parse_srt(path):
    """
    Read an SRT subtitle file into [(start_seconds, end_seconds, text), ...].

    Timed captions appear when the words are actually spoken, independent of
    where the shots cut -- which is what you want whenever you have the real
    audio, rather than inferring timing from word counts.
    """
    import re as _re
    entries, block = [], []
    with open(path, encoding="utf-8-sig") as f:
        raw = f.read().replace("\r\n", "\n")
    for chunk in raw.strip().split("\n\n"):
        lines = [ln for ln in chunk.split("\n") if ln.strip()]
        if len(lines) < 2:
            continue
        tline = next((ln for ln in lines if "-->" in ln), None)
        if not tline:
            continue
        m = _re.findall(r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})", tline)
        if len(m) != 2:
            continue
        def secs(g):
            h, mi, sec, ms = (int(x) for x in g)
            return h * 3600 + mi * 60 + sec + ms / (1000 if len(g[3]) == 3 else 100)
        start, end = secs(m[0]), secs(m[1])
        text = " ".join(lines[lines.index(tline) + 1:]).strip()
        # make_captions.py marks lines it is unsure of with a trailing "  # ?".
        # Strip anything from "  #" on, so a marker left in by accident cannot
        # end up burned into the video.
        text = text.split("  #")[0].strip()
        if text and end > start:
            entries.append((start, end, text))
    entries.sort(key=lambda e: e[0])
    return entries


def overlay_timed_captions(video_path, entries, out_path, build_dir, config,
                           caption_bottom=160):
    """
    Burn timed captions onto a finished visual track.

    Each caption is a transparent PNG overlaid only between its own start
    and end times, so captions are free to span shot boundaries.
    """
    inputs = ["-i", video_path]
    for i, (_s, _e, text) in enumerate(entries):
        png = os.path.join(build_dir, f"srtcap_{i:03d}.png")
        render_caption_png(text, png, config.WIDTH, config.HEIGHT, config,
                           bottom_margin=caption_bottom)
        inputs += ["-i", png]

    steps, prev = [], "0:v"
    for i, (start, end, _t) in enumerate(entries):
        label = f"v{i}"
        steps.append(
            f"[{prev}][{i+1}:v]overlay=0:0:format=auto:"
            f"enable='between(t,{start:.3f},{end:.3f})'[{label}]"
        )
        prev = label
    filt = ";".join(steps)

    subprocess.run(
        ["ffmpeg", "-y", *inputs, "-filter_complex", filt,
         "-map", f"[{prev}]", "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-preset", "veryfast", "-crf", "20", "-an", out_path],
        check=True, capture_output=True,
    )
    return out_path



def music_gain_for(voice_path, music_path, under_db):
    """The gain that puts a bed `under_db` below the narration.

    A raw volume multiplier only works if you already know how loud the
    track is. Measuring both and solving for the gap means any bed --
    one from make_music.py, or something the user found -- lands in the
    same place, and the number in the command line is the thing you
    actually care about."""
    vi, _ = measure_loudness(voice_path)
    mi, _ = measure_loudness(music_path)
    if vi is None or mi is None:
        return 0.5
    return float(10 ** (((vi - under_db) - mi) / 20.0))


def _bed_under_speech(voice_path, bed_path):
    """How far the ducked bed sits below the narration while it speaks.

    Measured against the bed rendered ON ITS OWN through the same
    sidechain, not against the finished mix. Trying to read it off the
    mix means reading it in the gaps, where the voice's own room tone
    and breaths are most of what is left -- that over-reports the bed by
    5 dB or so, and 5 dB is the difference between a bed you feel and
    one you cannot hear on a phone speaker."""
    import numpy as np

    def pcm(p):
        raw = subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-i", p,
             "-f", "s16le", "-ac", "1", "-ar", "48000", "-"],
            capture_output=True).stdout
        return np.frombuffer(raw, "<i2").astype(np.float64) / 32768

    v, b = pcm(voice_path), pcm(bed_path)
    if v.size == 0 or b.size == 0:
        return None
    hop, win = 480, 1440
    n = min((v.size - win) // hop, (b.size - win) // hop)
    if n < 10:
        return None

    def env(x):
        return np.array([np.sqrt((x[j:j + win] ** 2).mean() + 1e-12)
                         for j in range(0, n * hop, hop)])

    vdb, bdb = 20 * np.log10(env(v)), 20 * np.log10(env(b))
    speech = vdb > vdb.max() - 30
    if not speech.any():
        return None
    return float(vdb[speech].mean() - bdb[speech].mean())


def mix_music(voice_path, music_path, out_path, volume=None, duck=True, fade=1.5,
              target_lufs=-14.0, under_db=20.0,
              threshold=0.12, ratio=5, attack=20, release=400):
    """
    Mix a music bed under narration.

    With duck=True the music is sidechain-compressed by the voice: it drops
    automatically whenever someone is speaking and swells back in the gaps.
    That is what makes a bed sit *under* a voice instead of fighting it, and
    it is the single biggest difference between an amateur and a clean mix.

    The music is also looped if it is shorter than the narration, trimmed if
    longer, and faded at both ends so it never starts or stops abruptly.

    The sidechain used to run threshold=0.02 ratio=12, which is close to
    limiting and triggered on almost any speech. Measured against a real
    read, that buried the bed 44 dB under the voice -- not a bed, just
    an absence -- and ducked it by 18 dB every time a word started, so
    what little was audible pumped. Softer settings put it 20 dB down
    with an 8 dB duck, which is where a bed belongs: felt during the
    speech, present in the gaps, never competing.

    The result is written as PCM at 48 kHz. It used to be written as AAC
    -- into a file named .wav -- which cost a lossy generation here and
    another at the mux, and inherited loudnorm's 192 kHz internal rate so
    the encoder settled on 96 kHz. Both are silent problems: nothing
    fails, the audio is just quietly worse and twice the size it needs
    to be.
    """
    voice_dur = ffprobe_duration(voice_path)
    auto = volume is None
    if auto:
        volume = music_gain_for(voice_path, music_path, under_db)

    if duck:
        # Split the voice: one copy drives the compressor's sidechain, the
        # other is the audible narration.
        filt = (
            f"[1:a]volume={volume},afade=t=in:st=0:d={fade},"
            f"afade=t=out:st={max(voice_dur - fade, 0):.2f}:d={fade}[music];"
            f"[0:a]asplit=2[v1][v2];"
            f"[music][v1]sidechaincompress="
            f"threshold={threshold}:ratio={ratio}:attack={attack}:"
            f"release={release}:makeup=1[ducked];"
            f"[v2][ducked]amix=inputs=2:normalize=0:duration=first:dropout_transition=0,"
            f"alimiter=limit=0.95,"
            f"loudnorm=I={target_lufs}:TP=-1.5:LRA=11,"
            f"aresample=48000[a]"
        )
    else:
        filt = (
            f"[1:a]volume={volume},afade=t=in:st=0:d={fade},"
            f"afade=t=out:st={max(voice_dur - fade, 0):.2f}:d={fade}[music];"
            f"[0:a][music]amix=inputs=2:normalize=0:duration=first:dropout_transition=0,"
            f"alimiter=limit=0.95,"
            f"loudnorm=I={target_lufs}:TP=-1.5:LRA=11,"
            f"aresample=48000[a]"
        )

    def render(vol):
        f = filt.replace(f"volume={volume},", f"volume={vol},", 1)
        subprocess.run(
            ["ffmpeg", "-y", "-i", voice_path,
             "-stream_loop", "-1", "-i", music_path,  # loop music to cover the read
             "-filter_complex", f, "-map", "[a]",
             "-t", f"{voice_dur:.3f}",
             "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", out_path],
            check=True, capture_output=True,
        )

    if auto and duck:
        # Solving from loudness alone sets the bed `under_db` down BEFORE
        # the compressor, which then pulls it ~8 dB further and leaves it
        # inaudible. Render the ducked bed alone, measure where it really
        # landed, and correct. Two cheap passes beat modelling the duck.
        probe = out_path + ".bed.wav"
        sc = (f"[1:a]volume=%s[m];[m][0:a]sidechaincompress="
              f"threshold={threshold}:ratio={ratio}:attack={attack}:"
              f"release={release}:makeup=1[d]")
        for _ in range(3):
            subprocess.run(
                ["ffmpeg", "-y", "-v", "error", "-i", voice_path,
                 "-stream_loop", "-1", "-i", music_path,
                 "-filter_complex", sc % volume, "-map", "[d]",
                 "-t", f"{voice_dur:.3f}",
                 "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", probe],
                check=True, capture_output=True)
            got = _bed_under_speech(voice_path, probe)
            if got is None or abs(got - under_db) <= 0.5:
                break
            volume *= float(10 ** ((got - under_db) / 20.0))
        os.remove(probe)
        print(f"  bed gain {volume:.3f}"
              + (f" -> {got:.1f} dB under the narration while it speaks"
                 if got is not None else ""))
    elif auto:
        print(f"  bed gain {volume:.3f}")
    else:
        print(f"  bed gain {volume:.3f} (given)")

    render(volume)
    return out_path


def shots_from_srt(entries, shot_map, images, total_duration):
    """
    Build the shot list from caption timings plus an explicit image per
    caption, so each image illustrates the line actually being spoken.

    Cycling images blindly is the usual reason a slideshow feels subtly
    wrong: the viewer hears one thing and sees another. Mapping them by
    hand fixes it.

    Runs of the same image are merged into one continuous shot, otherwise
    the camera move would visibly restart every time the caption changed,
    which reads as a stutter.

    Returns [(image_path, start, duration), ...] covering the whole
    duration with no gaps.
    """
    if len(shot_map) != len(entries):
        raise ValueError(
            f"--shot-map has {len(shot_map)} entries but the SRT has {len(entries)} "
            f"captions; they must correspond one to one."
        )
    bad = [i for i in shot_map if i < 0 or i >= len(images)]
    if bad:
        raise ValueError(
            f"--shot-map refers to image index {bad[0]}, but only {len(images)} "
            f"image(s) were supplied (valid range 0-{len(images) - 1})."
        )

    groups = []
    for idx, (start, _end, _text) in zip(shot_map, entries):
        if groups and groups[-1][0] == idx:
            continue
        groups.append((idx, start))

    shots = []
    for gi, (idx, start) in enumerate(groups):
        begin = 0.0 if gi == 0 else start
        end = groups[gi + 1][1] if gi + 1 < len(groups) else total_duration
        shots.append((images[idx], begin, max(end - begin, 0.05)))
    return shots


def collect_images(images_arg):
    if os.path.isdir(images_arg):
        found = []
        for ext in IMAGE_EXTS:
            found.extend(glob.glob(os.path.join(images_arg, f"*.{ext}")))
        # Case-insensitive dedupe on some filesystems.
        found = sorted(set(os.path.realpath(f) for f in found))
        return sorted(found, key=lambda p: os.path.basename(p).lower())
    paths = [p.strip() for p in images_arg.split(",") if p.strip()]
    missing = [p for p in paths if not os.path.isfile(p)]
    if missing:
        raise FileNotFoundError(f"Image(s) not found: {', '.join(missing)}")
    return paths


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--images", required=True,
                   help="Folder of images (used in filename order), or a comma-separated list")
    p.add_argument("--voiceover", required=True, help="Audio file: mp3, wav, m4a, aac, ogg, flac")
    p.add_argument("--out", required=True, help="Output .mp4 path")
    p.add_argument("--captions", default=None,
                   help="Text file, one caption per line, matched to images in order")
    p.add_argument("--srt", default=None,
                   help="SRT file of timed captions. Captions appear at their own timestamps "
                        "rather than being tied to shot boundaries -- use this whenever you "
                        "know the real timing of the read.")
    p.add_argument("--no-captions", action="store_true", help="Render without any burned-in text")
    p.add_argument("--fit", choices=["cover", "contain"], default="contain",
                   help="contain (default) fits the whole image with a blurred backdrop; "
                        "cover fills the frame and center-crops")
    p.add_argument("--shot-map", default=None,
                   help="Comma-separated image index per SRT caption, e.g. '3,6,4,4,1'. "
                        "Lets each image illustrate the line being spoken instead of "
                        "cycling blindly. Requires --srt. Consecutive repeats merge "
                        "into one continuous shot.")
    p.add_argument("--motions", default=None,
                   help="Comma-separated camera moves, one per shot (after "
                        "--shot-map merging, if used). Options: push_in, "
                        "pull_out, pan_left_right, pan_right_left, static_drift, "
                        "hold, hard_zoom_then_push_in. Default cycles a varied "
                        "pattern. Use 'hold' for any shot carrying text the "
                        "viewer is meant to read -- every other option, "
                        "static_drift included, resamples the type each frame.")
    p.add_argument("--music", default=None, help="Optional background music file, mixed low")
    p.add_argument("--music-under", type=float, default=22.0, metavar="DB",
                   help="How far below the narration the bed sits WHILE IT IS "
                        "SPEAKING, in dB (default 22). The gain is measured "
                        "rather than guessed, so any track lands in the same "
                        "place. Lower numbers are louder; below about 18 the "
                        "bed starts competing with the words.")
    p.add_argument("--music-volume", type=float, default=None,
                   help="Music level relative to narration (default 0.18)")
    p.add_argument("--no-duck", action="store_true",
                   help="Disable sidechain ducking. By default the music dips automatically "
                        "whenever the voice speaks, which is almost always what you want.")
    p.add_argument("--music-fade", type=float, default=1.5,
                   help="Fade in/out on the music bed, in seconds (default 1.5)")
    p.add_argument("--pad", default=None,
                   help="With --fit contain, fill the empty area with a solid colour "
                        "(e.g. '#0b0b0d' or 'black') instead of a blurred copy of the "
                        "image. Cleaner for panels that already contain text.")
    p.add_argument("--safe-area", action="store_true",
                   help="Fit each image into the area the Shorts interface does NOT "
                        "cover (title/description strip along the bottom, action "
                        "buttons down the right, top bar) instead of the full frame. "
                        "Use this whenever your images already have text in them -- "
                        "otherwise the lowest line ends up behind the video title. "
                        "Requires --fit contain and --pad.")
    p.add_argument("--safe-margins", default=None, metavar="TOP,RIGHT,BOTTOM",
                   help="How much of the frame the Shorts interface covers, in pixels "
                        "at 1080x1920 (default 90,150,320). The safe box is centred, so "
                        "the right value is mirrored on the left and sets the usable "
                        "width -- lowering it is how you get a bigger picture back. "
                        "Only useful with --safe-area.")
    p.add_argument("--gentle", action="store_true",
                   help="Use a barely-there drift on every shot instead of the usual "
                        "push-ins and pans. Worth it for images that already contain "
                        "text: a hard zoom makes burned-in type crawl and shimmer, and "
                        "with --safe-area it also forces the image much smaller, since "
                        "the frame has to leave room for the zoom to grow into.")
    p.add_argument("--sharpen", type=float, default=0.0,
                   help="Unsharp amount (0-3) applied after fitting. Useful when source "
                        "images are much smaller than 1080x1920 and burned-in text goes "
                        "soft. 0.8-1.2 is a sensible range; 0 disables.")
    p.add_argument("--min-shot", type=float, default=1.8,
                   help="Shortest a single shot may be, in seconds (default 1.8). Short shots "
                        "are lengthened and the time taken from longer ones. 0 disables.")
    p.add_argument("--loudness", type=float, default=-14.0, metavar="LUFS",
                   help="Normalise the finished audio to this integrated loudness "
                        "(default -14, which is what YouTube normalises toward). "
                        "YouTube only turns loud audio DOWN, never quiet audio up, so "
                        "a quiet export stays quiet next to everything else in the "
                        "feed. Pass 0 to disable and keep the source levels.")
    p.add_argument("--keep-build", action="store_true", help="Keep intermediate files for inspection")
    args = p.parse_args()

    config = Config()
    config.check_dependencies()
    config.FIT_MODE = args.fit
    if args.loudness == 0:
        args.loudness = None            # explicit opt-out, keep source levels

    safe_margins = None
    if args.safe_margins:
        try:
            t, r, b = (int(v) for v in args.safe_margins.split(","))
        except ValueError:
            print("--safe-margins wants three whole numbers, e.g. 90,150,320")
            sys.exit(1)
        safe_margins = {"top": t, "right": r, "bottom": b}

    # Fail here rather than rendering a video that silently ignored the flag.
    # --pad is no longer required: without it the margin is filled by a blurred
    # copy of the panel, which fills the 9:16 frame instead of letterboxing it.
    if args.safe_area and args.fit != "contain":
        print("--safe-area needs --fit contain. With --fit cover the image is "
              "cropped to fill the frame, so there is no margin to keep clear of "
              "the interface. Try: --fit contain --safe-area")
        sys.exit(1)

    if not os.path.isfile(args.voiceover):
        print(f"Voiceover not found: {args.voiceover}")
        sys.exit(1)
    if os.path.splitext(args.voiceover)[1].lower() not in AUDIO_EXTS:
        print(f"Warning: {os.path.splitext(args.voiceover)[1]} is an unusual audio extension; "
              f"attempting it anyway.")

    images = collect_images(args.images)
    if not images:
        print(f"No images found in {args.images}")
        sys.exit(1)

    captions = []
    if args.captions and not args.no_captions:
        with open(args.captions, encoding="utf-8") as f:
            captions = [ln.strip() for ln in f if ln.strip()]

    # An SRT is two separate things: a set of timings, and some text to burn.
    # --no-captions suppresses only the burning. The timings stay available,
    # so --shot-map can still cut shots on the spoken lines even when the
    # text is already baked into the images.
    srt_entries = parse_srt(args.srt) if args.srt else []
    burn_srt = bool(srt_entries) and not args.no_captions
    use_captions = bool(captions) and not args.no_captions and not burn_srt
    if use_captions and len(captions) != len(images):
        print(f"NOTE: {len(images)} images but {len(captions)} caption lines.")
        if len(captions) < len(images):
            print("      Trailing images will run without a caption.")
        else:
            print("      Extra caption lines past the last image are ignored.")

    audio_duration = ffprobe_duration(args.voiceover)

    # Weight each image's screen time by its caption's word count so the
    # visuals track the read. With no captions, split evenly.
    if use_captions:
        weights = [max(len(captions[i].split()), 1) if i < len(captions) else 3
                   for i in range(len(images))]
    else:
        weights = [1] * len(images)
    total_w = sum(weights)
    durations = [audio_duration * (w / total_w) for w in weights]
    durations = enforce_min_duration(durations, audio_duration, args.min_shot)

    if args.shot_map:
        if not srt_entries:
            print("--shot-map requires --srt (it maps one image per caption).")
            sys.exit(1)
        smap = [int(x) for x in args.shot_map.replace(" ", "").split(",") if x != ""]
        mapped = shots_from_srt(srt_entries, smap, images, audio_duration)
        images = [sp for sp, _st, _d in mapped]
        durations = [d for _sp, _st, d in mapped]
        print(f"  shot map: {len(smap)} captions -> {len(mapped)} merged shots")

    if args.gentle and args.motions:
        print("--gentle overrides --motions; pass one or the other.")
        sys.exit(1)

    if args.gentle:
        motions = ["static_drift"] * len(images)
    elif args.motions:
        motions = [m.strip() for m in args.motions.split(",") if m.strip()]
        if len(motions) != len(images):
            print(f"--motions has {len(motions)} entries but there are {len(images)} images.")
            sys.exit(1)
    else:
        motions = [DEFAULT_MOTION_CYCLE[i % len(DEFAULT_MOTION_CYCLE)]
                   for i in range(len(images))]

    # Captions default to sitting 160px off the bottom, which is underneath
    # the Shorts title strip. With --safe-area, lift them clear of it: a
    # caption hidden behind the title is worse than no caption, because the
    # narration still refers to text the viewer cannot read.
    # This is unconditional, not tied to --safe-area: a caption behind the
    # title strip is never what anyone wanted, whatever the fit mode.
    _m = dict(SHORTS_SAFE)
    if safe_margins:
        _m.update(safe_margins)
    caption_bottom = _m["bottom"] + 30

    # One headroom for the whole video rather than one per shot: sizing each
    # panel against its own motion would make them visibly change size from
    # cut to cut.
    headroom = peak_zoom(motions, config) if args.safe_area else 1.0

    build_dir = tempfile.mkdtemp(prefix="makevideo_")
    print(f"{len(images)} image(s), voiceover {audio_duration:.1f}s, "
          f"captions: {'yes' if use_captions else 'no'}")
    if args.safe_area:
        print(f"  safe area on, sized for {headroom:.2f}x peak zoom")

    segments = []
    for i, (src, dur, motion) in enumerate(zip(images, durations, motions)):
        fitted = os.path.join(build_dir, f"fit_{i:02d}.png")
        fit_image_to_canvas(src, fitted, config.WIDTH, config.HEIGHT,
                            mode=config.FIT_MODE, sharpen=args.sharpen,
                            pad_color=args.pad, safe_area=args.safe_area,
                            zoom_headroom=headroom, safe_margins=safe_margins)

        kb = os.path.join(build_dir, f"kb_{i:02d}.mp4")
        ken_burns_segment(fitted, dur, kb, config, motion=motion,
                          build_dir=build_dir, tag=f"kb_{i:02d}")

        if use_captions and i < len(captions):
            cap_png = os.path.join(build_dir, f"cap_{i:02d}.png")
            render_caption_png(captions[i], cap_png, config.WIDTH, config.HEIGHT, config,
                               bottom_margin=caption_bottom)
            seg = os.path.join(build_dir, f"seg_{i:02d}.mp4")
            overlay_caption(kb, cap_png, seg)
        else:
            seg = kb
        segments.append(seg)
        print(f"  [{i+1}/{len(images)}] {os.path.basename(src)} "
              f"-> {dur:.1f}s, {motion}")

    concat = os.path.join(build_dir, "concat.mp4")
    concat_segments(segments, concat, os.path.join(build_dir, "filelist.txt"))

    # Where the cuts landed, for the transition pass. Every shot here is a
    # still, so nothing in this edit is generated footage.
    shot_list = os.path.splitext(args.out)[0] + ".shots.json"
    sl = write_shot_list(shot_list, images, segments)
    print(f"  shot list: {len(sl['cuts'])} cuts -> {shot_list}")

    if burn_srt:
        print(f"  burning {len(srt_entries)} timed caption(s) from {os.path.basename(args.srt)}")
        captioned = os.path.join(build_dir, "captioned.mp4")
        overlay_timed_captions(concat, srt_entries, captioned, build_dir, config,
                               caption_bottom=caption_bottom)
        concat = captioned

    out_dir = os.path.dirname(os.path.abspath(args.out))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    if args.music:
        if not os.path.isfile(args.music):
            print(f"Music file not found: {args.music}")
            sys.exit(1)
        mixed = os.path.join(build_dir, "mixed.wav")
        # Normalised inside the mix, so don't normalise again on the way out.
        mix_music(args.voiceover, args.music, mixed,
                  volume=args.music_volume, duck=not args.no_duck,
                  fade=args.music_fade, target_lufs=args.loudness,
                  under_db=args.music_under)
        mux_audio(concat, mixed, args.out, target_lufs=None)
    else:
        mux_audio(concat, args.voiceover, args.out, target_lufs=args.loudness)

    final_dur = ffprobe_duration(args.out)
    print(f"\nDone: {args.out}  ({final_dur:.1f}s)")
    if args.loudness is not None:
        # mux_audio leaves audio that already measures on target alone and
        # says so, so don't claim here that it was normalised.
        i, tp = measure_loudness(args.out)
        if i is not None:
            print(f"  audio {i:.1f} LUFS, true peak {tp:.1f} dBTP "
                  f"(target {args.loudness})")

    if args.keep_build:
        print(f"Intermediates kept in: {build_dir}")
    else:
        shutil.rmtree(build_dir, ignore_errors=True)


if __name__ == "__main__":
    main()

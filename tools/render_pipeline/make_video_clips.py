#!/usr/bin/env python3
"""
Build one video from generated CLIPS and a voiceover, instead of stills.

  python3 make_video_clips.py --clips ./veo --voiceover vo.mp3 \
      --srt beats.srt --shot-map 0,1,1,2,3 --out video.mp4

Same idea as make_video.py, and the flags line up, but the shots already
move. So there is no Ken Burns here: a zoom applied on top of footage that
is already drifting reads as a mistake, and the whole reason to generate
clips is that the motion is in the shot.

What this actually has to solve, none of which the image path needs:

  * Length. A generated clip is a fixed length -- Veo hands you eight
    seconds whatever the beat needs. Clips are cut to the beat, and a clip
    too short for its beat holds its last frame rather than being stretched
    or looped, because a slowed shot looks wrong and a loop is worse.
  * Sound. Veo generates audio with the picture. Left in, it fights the
    narration; every clip is muted by default, and --clip-audio mixes it
    back in low if you want the room tone.
  * Format. Clips are normalised to one size, frame rate and pixel format
    before joining, since concat refuses anything else.
  * Repeats. Reusing a clip is normal with a short set, so each further use
    starts further into the source. The same eight seconds then supplies
    several different-looking shots instead of an obvious repeat.

Everything downstream is unchanged: caption it with ShortsCaptioner and add
source cards with overlay_cards.py exactly as you would a stills video.
"""

import argparse
import glob
import os
import subprocess
import sys
import tempfile

from make_video import (enforce_min_duration, mix_music, parse_srt,
                        shots_from_srt)
from pipeline.assemble import (concat_segments, ffprobe_duration,
                               fit_image_to_canvas, ken_burns_segment, mux_audio)
from pipeline.config import Config

CLIP_EXTS = ("mp4", "mov", "webm", "m4v", "MP4", "MOV", "WEBM")
STILL_EXTS = ("jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG")


def is_still(path):
    return path.rsplit(".", 1)[-1] in STILL_EXTS


def collect_clips(folder):
    """
    Everything in the folder, in filename order -- clips and stills together.

    A set of generated shots is almost never all footage. Some prompts get
    refused, some shots are not worth a generation because nothing in them
    is supposed to move, and credits run out. Mixing is the normal case, so
    the builder takes both and the shot map does not care which is which.
    """
    if not os.path.isdir(folder):
        print(f"Not a folder: {folder}")
        sys.exit(1)
    out = []
    for ext in CLIP_EXTS + STILL_EXTS:
        out.extend(glob.glob(os.path.join(folder, f"*.{ext}")))
    return sorted(set(out))


def prepare_segment(src, start, duration, out_path, width, height, fps,
                    clip_audio=0.0):
    """
    Cut one beat out of one clip, normalised so concat will accept it.

    Scaled to cover and centre-cropped rather than letterboxed: these are
    purpose-generated vertical shots, so a crop takes a sliver off the edge
    while bars would announce that the source was the wrong shape.
    """
    src_dur = ffprobe_duration(src)
    avail = max(src_dur - start, 0.0)

    vf = (f"scale={width}:{height}:force_original_aspect_ratio=increase,"
          f"crop={width}:{height},fps={fps},setsar=1,format=yuv420p")

    if avail + 1e-3 < duration:
        # Not enough footage left: hold the final frame for the remainder.
        # Slowing the clip to fit would change the motion the shot was
        # generated for, which is the one thing worth protecting here.
        vf += f",tpad=stop_mode=clone:stop_duration={duration - avail:.3f}"
        take = avail
    else:
        take = duration

    cmd = ["ffmpeg", "-y", "-ss", f"{start:.3f}", "-i", src,
           "-t", f"{take:.3f}", "-vf", vf]
    if clip_audio > 0:
        cmd += ["-af", f"volume={clip_audio}", "-c:a", "aac", "-b:a", "128k"]
    else:
        cmd += ["-an"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-video_track_timescale", "90000", out_path]
    subprocess.run(cmd, check=True, capture_output=True)
    return out_path


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--clips", required=True, help="Folder of clips, used in filename order")
    p.add_argument("--voiceover", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--srt", default=None,
                   help="Beat timings. With --shot-map, one clip per caption.")
    p.add_argument("--shot-map", default=None,
                   help="Comma-separated clip index per caption, e.g. 0,0,1,2")
    p.add_argument("--clip-audio", type=float, default=0.0,
                   help="Level to mix the clips' own audio back in (default 0, "
                        "muted). Veo generates sound with the picture and it "
                        "fights the narration; 0.05-0.12 gives room tone.")
    p.add_argument("--reuse-offset", type=float, default=2.0,
                   help="Seconds further into a clip each time it is reused "
                        "(default 2.0). Stops a repeated clip looking repeated.")
    p.add_argument("--music", default=None)
    p.add_argument("--music-volume", type=float, default=0.16)
    p.add_argument("--no-duck", action="store_true")
    p.add_argument("--music-fade", type=float, default=1.5)
    p.add_argument("--still-motion", default="static_drift",
                   choices=["static_drift", "push_in", "pull_out",
                            "pan_left_right", "pan_right_left"],
                   help="Camera move applied to stills so they sit alongside "
                        "footage (default static_drift, the gentlest)")
    p.add_argument("--min-shot", type=float, default=1.2)
    p.add_argument("--loudness", type=float, default=-14.0, metavar="LUFS")
    p.add_argument("--keep-build", action="store_true")
    args = p.parse_args()

    config = Config()
    config.check_dependencies()
    if args.loudness == 0:
        args.loudness = None

    if not os.path.isfile(args.voiceover):
        print(f"Voiceover not found: {args.voiceover}")
        sys.exit(1)

    clips = collect_clips(args.clips)
    if not clips:
        print(f"No clips found in {args.clips} "
              f"(looked for {', '.join(CLIP_EXTS[:4])})")
        sys.exit(1)

    audio_duration = ffprobe_duration(args.voiceover)
    srt_entries = parse_srt(args.srt) if args.srt else []

    if args.shot_map:
        if not srt_entries:
            print("--shot-map needs --srt: it maps one clip per caption.")
            sys.exit(1)
        smap = [int(x) for x in args.shot_map.replace(" ", "").split(",") if x != ""]
        bad = [i for i in smap if i >= len(clips)]
        if bad:
            print(f"--shot-map refers to clip {max(bad)} but only "
                  f"{len(clips)} clip(s) were found.")
            sys.exit(1)
        mapped = shots_from_srt(srt_entries, smap, clips, audio_duration)
        order = [(sp, d) for sp, _st, d in mapped]
    else:
        each = audio_duration / len(clips)
        order = [(c, each) for c in clips]

    durations = enforce_min_duration([d for _c, d in order], audio_duration, args.min_shot)
    order = [(c, d) for (c, _old), d in zip(order, durations)]

    build = tempfile.mkdtemp(prefix="clipvid_")
    n_clips = sum(1 for c in clips if not is_still(c))
    print(f"{n_clips} clip(s) + {len(clips) - n_clips} still(s) -> "
          f"{len(order)} shot(s), voiceover {audio_duration:.1f}s")

    seen = {}
    segments = []
    n_still = 0
    for i, (src, dur) in enumerate(order):
        n = seen.get(src, 0)
        seen[src] = n + 1
        seg = os.path.join(build, f"seg_{i:03d}.mp4")

        if is_still(src):
            # Give the still a slow move so it reads as a shot rather than a
            # held photograph. Deliberately gentler than the stills pipeline
            # uses: next to real footage a pronounced Ken Burns is what makes
            # a mixed edit look mixed.
            fitted = os.path.join(build, f"fit_{i:03d}.png")
            fit_image_to_canvas(src, fitted, config.WIDTH, config.HEIGHT,
                                mode="cover", sharpen=0.4)
            kb = os.path.join(build, f"kb_{i:03d}.mp4")
            ken_burns_segment(fitted, dur, kb, config, motion=args.still_motion,
                              build_dir=build, tag=f"kb_{i:03d}")
            # Through the same normaliser as the footage, so concat sees one
            # consistent stream rather than two encoders' output.
            prepare_segment(kb, 0.0, dur, seg, config.WIDTH, config.HEIGHT,
                            config.FPS, clip_audio=0.0)
            n_still += 1
            note = f"  (still, {args.still_motion})"
        else:
            start = n * args.reuse_offset      # later uses start further in
            prepare_segment(src, start, dur, seg, config.WIDTH, config.HEIGHT,
                            config.FPS, clip_audio=args.clip_audio)
            note = f", from {start:.1f}s (use {n + 1})" if n else ""

        segments.append(seg)
        print(f"  [{i+1}/{len(order)}] {os.path.basename(src)} -> {dur:.1f}s{note}")

    concat = os.path.join(build, "concat.mp4")
    concat_segments(segments, concat, os.path.join(build, "filelist.txt"))

    if args.music:
        if not os.path.isfile(args.music):
            print(f"Music not found: {args.music}")
            sys.exit(1)
        mixed = os.path.join(build, "mixed.m4a")
        mix_music(args.voiceover, args.music, mixed, volume=args.music_volume,
                  duck=not args.no_duck, fade=args.music_fade,
                  target_lufs=args.loudness)
        mux_audio(concat, mixed, args.out, target_lufs=None)
    else:
        mux_audio(concat, args.voiceover, args.out, target_lufs=args.loudness)

    print(f"\nDone: {args.out}  ({ffprobe_duration(args.out):.1f}s)")
    if args.loudness is not None:
        print(f"  audio normalised to {args.loudness} LUFS")
    if not args.keep_build:
        import shutil
        shutil.rmtree(build, ignore_errors=True)
    else:
        print(f"  intermediates kept in {build}")


if __name__ == "__main__":
    main()

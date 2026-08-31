import os
import shutil
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFilter, ImageFont


def ffprobe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        check=True, capture_output=True, text=True,
    )
    return float(out.stdout.strip())



def _sharpen(img, amount):
    """
    Unsharp mask, for when a source image has to be scaled up a long way.

    Upscaling softens edges, and burned-in text is where that shows first.
    A modest unsharp pass recovers a useful amount of apparent detail. It
    cannot invent resolution that was never there -- if the source is far
    too small, the honest fix is a bigger source.
    """
    from PIL import ImageFilter as _IF
    pct = int(max(0.0, min(amount, 3.0)) * 100)
    return img.filter(_IF.UnsharpMask(radius=1.6, percent=pct, threshold=2))


# Roughly what the YouTube Shorts interface covers on a 1080x1920 frame.
# The bottom strip carries the title, channel name and description; the right
# column carries the like/comment/share buttons. Anything placed underneath
# them is simply not seen, so text belongs outside these.
SHORTS_SAFE = {"bottom": 320, "top": 90, "right": 150}

# Peak magnification of each motion, needed by the safe-area fit below. The
# Ken Burns move enlarges the fitted canvas about its centre, so a panel
# placed exactly inside the safe box at rest will have grown back out of it
# by the end of a push-in. Sizing has to be done against the peak, not rest.
MOTION_PEAK_ZOOM = {
    "push_in": None,            # None -> config.MAX_ZOOM
    "pull_out": None,
    "pan_left_right": 1.15,
    "pan_right_left": 1.15,
    "static_drift": 1.04,
    "hard_zoom_then_push_in": 1.3,
}


def peak_zoom(motions, config):
    """Largest magnification any of `motions` reaches."""
    return max(MOTION_PEAK_ZOOM.get(m, None) or config.MAX_ZOOM for m in motions)


def safe_box(width, height, zoom_headroom=1.0, margins=None):
    """
    The largest box that is centred in the frame, clear of the interface, and
    still clear of it once the Ken Burns move has magnified everything.

    Centred is the point. The interface is lopsided -- buttons down the right,
    a title strip along the bottom -- so the region it leaves free is lopsided
    too, and an image centred in *that* sits visibly left of, and above, the
    middle of the frame. It reads as a mistake on every single shot. So each
    margin is mirrored onto the opposite side: the box is symmetric about the
    frame centre, and the image lands where the eye expects it.

    That symmetry costs width, since the widest safe box is now set by the
    button column on both sides. Pass smaller `margins` to buy it back.

    Returns (x0, y0, x1, y1) as floats.
    """
    m = dict(SHORTS_SAFE)
    if margins:
        m.update(margins)

    # Mirror the larger margin on each axis, so the result is centred.
    half_w = width / 2.0 - max(m["right"], 0)
    half_h = height / 2.0 - max(m["top"], m["bottom"], 0)

    # Then leave the zoom somewhere to grow into. zoompan maps p -> c + (p-c)*z
    # about the frame centre, so the region still inside the box at peak zoom
    # is the box scaled by 1/z -- which, for a centred box, is just this.
    z = max(zoom_headroom, 1.0)
    half_w /= z
    half_h /= z

    cx, cy = width / 2.0, height / 2.0
    return cx - half_w, cy - half_h, cx + half_w, cy + half_h


def fit_image_to_canvas(src_path, out_path, width, height, mode="cover", sharpen=0.0,
                        pad_color=None, safe_area=False, zoom_headroom=1.0,
                        safe_margins=None):
    """
    Fit an arbitrary image to the vertical canvas.

    mode="cover"   scale to fill, center-crop the overflow. Best for
                   purpose-made vertical art; will crop a landscape photo
                   hard, because 16:9 into 9:16 loses most of the frame.
    mode="contain" scale so the whole image fits, filling the remaining
                   space with a blurred enlarged copy of itself. Nothing is
                   cropped, which is usually what you want for photos or
                   diagrams you did not compose for vertical.

    safe_area=True fits the image into the region the Shorts interface does
    NOT cover, rather than into the whole frame. Essential for source images
    that already carry text near their edges: centring such a panel in the
    full frame pushes its lowest line under the title bar and its right edge
    under the action buttons. Only meaningful with mode="contain".

    zoom_headroom is the peak magnification the Ken Burns move will later
    apply. The safe box is shrunk toward the frame centre by that factor,
    because zoompan enlarges about the centre -- without this, a panel that
    sits perfectly inside the safe box on frame one has crept back under the
    interface by the end of a push-in. Note the cost: at the default 1.18
    this alone removes about a sixth of the usable width, so gentle motion
    ("static_drift", peak 1.04) leaves the panel far larger on screen.
    """
    img = Image.open(src_path)
    img = img.convert("RGB")
    src_ratio = img.width / img.height
    dst_ratio = width / height

    if mode == "contain":
        # A solid pad is cleaner than a blurred one when the source is a
        # designed panel: blurring a page of text just produces legible-ish
        # ghosts behind it, which reads as an accident rather than a choice.
        if pad_color:
            backdrop = Image.new("RGB", (width, height), pad_color)
            if safe_area:
                x0, y0, x1, y1 = safe_box(width, height, zoom_headroom, safe_margins)
                avail_w, avail_h = int(x1 - x0), int(y1 - y0)
                fw = avail_w
                fh = int(fw / src_ratio)
                if fh > avail_h:
                    fh = avail_h
                    fw = int(fh * src_ratio)
                fg = img.resize((max(fw, 1), max(fh, 1)), Image.LANCZOS)
                if sharpen > 0:
                    fg = _sharpen(fg, sharpen)
                # Centre within that box: horizontally clear of the buttons,
                # vertically in the band above the title strip.
                x = int(x0) + (avail_w - fw) // 2
                y = int(y0) + (avail_h - fh) // 2
                backdrop.paste(fg, (x, y))
                backdrop.save(out_path, quality=95)
                return out_path

            if src_ratio > dst_ratio:
                fw, fh = width, max(1, int(width / src_ratio))
            else:
                fh, fw = height, max(1, int(height * src_ratio))
            fg = img.resize((fw, fh), Image.LANCZOS)
            if sharpen > 0:
                fg = _sharpen(fg, sharpen)
            backdrop.paste(fg, ((width - fw) // 2, (height - fh) // 2))
            backdrop.save(out_path, quality=95)
            return out_path

        # Blurred, over-scaled backdrop so the frame is never empty.
        if src_ratio > dst_ratio:
            bw, bh = int(height * src_ratio), height
        else:
            bw, bh = width, int(width / src_ratio)
        scale = 1.25  # over-scale so blur has no dark edges
        backdrop = img.resize((int(bw * scale), int(bh * scale)), Image.LANCZOS)
        bl = (backdrop.width - width) // 2
        bt = (backdrop.height - height) // 2
        backdrop = backdrop.crop((bl, bt, bl + width, bt + height))
        backdrop = backdrop.filter(ImageFilter.GaussianBlur(28))

        # Foreground scaled to fit entirely inside the canvas.
        if src_ratio > dst_ratio:
            fw, fh = width, max(1, int(width / src_ratio))
        else:
            fh, fw = height, max(1, int(height * src_ratio))
        fg = img.resize((fw, fh), Image.LANCZOS)
        if sharpen > 0:
            fg = _sharpen(fg, sharpen)
        backdrop.paste(fg, ((width - fw) // 2, (height - fh) // 2))
        backdrop.save(out_path, quality=95)
        return out_path

    if src_ratio > dst_ratio:
        new_height = height
        new_width = int(src_ratio * new_height)
    else:
        new_width = width
        new_height = int(new_width / src_ratio)
    img = img.resize((new_width, new_height), Image.LANCZOS)
    left = (new_width - width) // 2
    top = (new_height - height) // 2
    img = img.crop((left, top, left + width, top + height))
    if sharpen > 0:
        img = _sharpen(img, sharpen)
    img.save(out_path, quality=95)
    return out_path



def _load_font(path, size):
    """
    Load a TrueType font, degrading to Pillow's built-in if none is
    available. Captions in the bitmap fallback look plainer, but a render
    that finishes and looks plain beats a render that dies on a phone with
    no fonts installed.
    """
    if path:
        try:
            return ImageFont.truetype(path, size)
        except Exception as exc:  # unreadable/corrupt font file
            print(f"[assemble] WARNING: could not load font {path!r} ({exc}); using built-in.")
    try:
        return ImageFont.load_default(size=size)   # Pillow >= 10.1
    except TypeError:
        return ImageFont.load_default()


def render_caption_png(text, out_path, width, height, config, accent_hex="#C9A227"):
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = _load_font(config.FONT_BOLD, 58)

    wrapped = textwrap.fill(text, width=22)
    lines = wrapped.split("\n")
    line_heights = [draw.textbbox((0, 0), ln, font=font)[3] for ln in lines]
    total_h = sum(line_heights) + (len(lines) - 1) * 14

    box_pad = 40
    box_top = height - total_h - 260
    box_bottom = height - 160
    draw.rounded_rectangle(
        [50, box_top - box_pad, width - 50, box_bottom + box_pad],
        radius=24, fill=(10, 10, 12, 190), outline=accent_hex, width=3,
    )

    y = box_top
    for ln, lh in zip(lines, line_heights):
        w = draw.textbbox((0, 0), ln, font=font)[2]
        x = (width - w) / 2
        draw.text((x + 2, y + 2), ln, font=font, fill=(0, 0, 0, 200))
        draw.text((x, y), ln, font=font, fill=(255, 255, 255, 255))
        y += lh + 14

    img.save(out_path)
    return out_path


def _run_zoompan(image_path, duration, out_path, config, zoom_expr, x_expr, y_expr):
    d_frames = max(int(duration * config.FPS), 1)
    ss = getattr(config, "SUPERSAMPLE", 1.5)
    # keep both dimensions even; some encoders reject odd sizes
    sw, sh = int(config.WIDTH * ss) // 2 * 2, int(config.HEIGHT * ss) // 2 * 2
    vf = (
        f"scale={sw}:{sh},"
        f"zoompan=z='{zoom_expr}':d={d_frames}:x='{x_expr}':y='{y_expr}':"
        f"s={config.WIDTH}x{config.HEIGHT}:fps={config.FPS}"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loop", "1", "-i", image_path, "-vf", vf,
         "-t", str(duration), "-pix_fmt", "yuv420p", out_path],
        check=True, capture_output=True,
    )
    return out_path


_CENTERED_X = "iw/2-(iw/zoom/2)"
_CENTERED_Y = "ih/2-(ih/zoom/2)"


def _push_in(image_path, duration, out_path, config, start_zoom=1.0, end_zoom=None, step=None):
    end_zoom = end_zoom or config.MAX_ZOOM
    step = step or config.ZOOM_PER_FRAME
    zoom_expr = f"if(eq(on,0),{start_zoom},min(zoom+{step},{end_zoom}))"
    return _run_zoompan(image_path, duration, out_path, config, zoom_expr, _CENTERED_X, _CENTERED_Y)


def _pull_out(image_path, duration, out_path, config, start_zoom=None, end_zoom=1.0):
    start_zoom = start_zoom or config.MAX_ZOOM
    step = (start_zoom - end_zoom) / max(duration * config.FPS, 1)
    zoom_expr = f"if(eq(on,0),{start_zoom},max(zoom-{step:.6f},{end_zoom}))"
    return _run_zoompan(image_path, duration, out_path, config, zoom_expr, _CENTERED_X, _CENTERED_Y)


def _pan(image_path, duration, out_path, config, direction="left_right", zoom=1.15):
    d_frames = max(int(duration * config.FPS), 1)
    zoom_expr = f"{zoom}"
    if direction == "left_right":
        x_expr = f"(iw-iw/zoom)*on/{max(d_frames-1,1)}"
    else:
        x_expr = f"(iw-iw/zoom)*(1-on/{max(d_frames-1,1)})"
    return _run_zoompan(image_path, duration, out_path, config, zoom_expr, x_expr, _CENTERED_Y)


def _static_drift(image_path, duration, out_path, config):
    return _push_in(image_path, duration, out_path, config, start_zoom=1.0, end_zoom=1.04, step=0.0006)


def ken_burns_segment(image_path, duration, out_path, config, motion="push_in", build_dir=None, tag=""):
    if motion == "push_in":
        return _push_in(image_path, duration, out_path, config)
    if motion == "pull_out":
        return _pull_out(image_path, duration, out_path, config)
    if motion == "pan_left_right":
        return _pan(image_path, duration, out_path, config, "left_right")
    if motion == "pan_right_left":
        return _pan(image_path, duration, out_path, config, "right_left")
    if motion == "static_drift":
        return _static_drift(image_path, duration, out_path, config)
    if motion == "hard_zoom_then_push_in":
        # Two-phase move on the same still: a quick punch-in, then a slow
        # continued push-in for the rest of the shot. Rendered as two clips
        # and concatenated, since zoompan can't easily vary its own rate
        # mid-expression.
        assert build_dir is not None, "hard_zoom_then_push_in needs build_dir for its temp clips"
        fast_seconds = min(1.5, duration * 0.3)
        slow_seconds = duration - fast_seconds
        fast_path = os.path.join(build_dir, f"{tag}_fast.mp4")
        slow_path = os.path.join(build_dir, f"{tag}_slow.mp4")
        _push_in(image_path, fast_seconds, fast_path, config, start_zoom=1.0, end_zoom=1.3, step=0.03)
        _push_in(image_path, slow_seconds, slow_path, config, start_zoom=1.3, end_zoom=config.MAX_ZOOM,
                  step=config.ZOOM_PER_FRAME)
        concat_segments([fast_path, slow_path], out_path, os.path.join(build_dir, f"{tag}_filelist.txt"))
        return out_path
    return _push_in(image_path, duration, out_path, config)


def overlay_caption(video_path, caption_png, out_path):
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-i", caption_png,
         "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto",
         "-pix_fmt", "yuv420p", "-an", out_path],
        check=True, capture_output=True,
    )
    return out_path


def concat_segments(segment_paths, out_path, list_file):
    with open(list_file, "w") as f:
        for p in segment_paths:
            f.write(f"file '{os.path.abspath(p)}'\n")
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file,
         "-c", "copy", out_path],
        check=True, capture_output=True,
    )
    return out_path


def mux_audio(video_path, audio_path, out_path):
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-i", audio_path,
         "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
         "-shortest", out_path],
        check=True, capture_output=True,
    )
    return out_path


def assemble_video(script, image_provider, tts_provider, build_dir, out_dir, config):
    os.makedirs(build_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)

    narration_path = os.path.join(build_dir, "narration.wav")
    tts_provider.synthesize(script.full_text, narration_path)
    total_duration = ffprobe_duration(narration_path)

    total_weight = sum(p.weight for p in script.image_prompts)
    durations = []
    remaining = total_duration
    for i, p in enumerate(script.image_prompts):
        if i == len(script.image_prompts) - 1:
            durations.append(max(remaining, config.MIN_SEGMENT_SECONDS))
        else:
            d = max(total_duration * (p.weight / total_weight), config.MIN_SEGMENT_SECONDS)
            durations.append(d)
            remaining -= d

    segment_paths = []
    caption_pool = [b.caption for b in script.beats] or [script.title]
    for i, (prompt, duration) in enumerate(zip(script.image_prompts, durations)):
        raw_path = os.path.join(build_dir, f"raw_{i:02d}.png")
        image_provider.generate(prompt.prompt, raw_path, config.WIDTH, config.HEIGHT,
                                context={"rank": script.rank, "slug": script.slug,
                                         "index": i, "is_thumbnail": False})
        fitted_path = os.path.join(build_dir, f"fit_{i:02d}.png")
        fit_image_to_canvas(raw_path, fitted_path, config.WIDTH, config.HEIGHT,
                            mode=getattr(config, "FIT_MODE", "cover"))

        kb_path = os.path.join(build_dir, f"kb_{i:02d}.mp4")
        ken_burns_segment(fitted_path, duration, kb_path, config,
                           motion=getattr(prompt, "motion", "push_in"),
                           build_dir=build_dir, tag=f"kb_{i:02d}")

        caption_text = caption_pool[min(i, len(caption_pool) - 1)]
        caption_png = os.path.join(build_dir, f"cap_{i:02d}.png")
        render_caption_png(caption_text, caption_png, config.WIDTH, config.HEIGHT, config)

        seg_path = os.path.join(build_dir, f"seg_{i:02d}.mp4")
        overlay_caption(kb_path, caption_png, seg_path)
        segment_paths.append(seg_path)

    concat_path = os.path.join(build_dir, "concat.mp4")
    concat_segments(segment_paths, concat_path, os.path.join(build_dir, "filelist.txt"))

    final_name = f"{script.rank:02d}_{script.slug}.mp4"
    final_path = os.path.join(out_dir, final_name)
    mux_audio(concat_path, narration_path, final_path)

    thumb_raw = os.path.join(build_dir, "thumb_raw.png")
    image_provider.generate(script.thumbnail_prompt, thumb_raw, config.WIDTH, config.HEIGHT,
                            context={"rank": script.rank, "slug": script.slug,
                                     "index": None, "is_thumbnail": True})
    thumb_path = os.path.join(out_dir, f"{script.rank:02d}_{script.slug}_thumb.jpg")
    fit_image_to_canvas(thumb_raw, thumb_path, config.WIDTH, config.HEIGHT,
                        mode=getattr(config, "FIT_MODE", "cover"))

    if not getattr(config, "KEEP_BUILD", False):
        shutil.rmtree(build_dir, ignore_errors=True)

    return {
        "video_path": final_path,
        "thumb_path": thumb_path,
        "duration": total_duration,
        "narration_path": narration_path,
    }

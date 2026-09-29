#!/usr/bin/env python3
"""
A small ffprobe stand-in, for machines that have ffmpeg but not ffprobe.

Install it as `ffprobe` on PATH and the rest of the pipeline works unchanged:

  pip install imageio-ffmpeg
  python -c "import imageio_ffmpeg,shutil,os; \
      p=imageio_ffmpeg.get_ffmpeg_exe(); \
      shutil.copy(p,'/usr/local/bin/ffmpeg'); os.chmod('/usr/local/bin/ffmpeg',0o755)"
  cp tools/render_pipeline/ffprobe_shim.py /usr/local/bin/ffprobe
  chmod +x /usr/local/bin/ffprobe

Why this exists: the usual ways to get a static build -- apt, or the PyPI
packages that fetch a zip -- reach hosts a restricted network blocks, and
`imageio-ffmpeg`, which installs from PyPI and works, ships ffmpeg WITHOUT
ffprobe. Everything the pipeline asks ffprobe for is already printed by
`ffmpeg -i` on stderr, so parsing that closes the gap with no download.

Deliberately NOT a general ffprobe. It answers the three queries this
repository actually makes -- format=duration, stream=height,
stream=width,height -- plus a few common stream fields, in the output forms
used here (csv=p=0, csv=p=0:s=x, default=nw=1, default=nw=1:nk=1). Anything
else exits non-zero with a clear message rather than printing something
plausible and wrong, because a silently wrong duration would desync a whole
video and take an hour to trace.
"""

import re
import subprocess
import sys

FFMPEG = "ffmpeg"


def probe(path):
    """Everything `ffmpeg -i` will tell us about the file."""
    out = subprocess.run([FFMPEG, "-hide_banner", "-i", path],
                         capture_output=True, text=True).stderr
    info = {"format": {}, "video": {}, "audio": {}}

    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
    if m:
        h, mi, s = m.groups()
        info["format"]["duration"] = f"{int(h)*3600 + int(mi)*60 + float(s):.6f}"
    m = re.search(r"bitrate: (\d+) kb/s", out)
    if m:
        info["format"]["bit_rate"] = str(int(m.group(1)) * 1000)

    m = re.search(r"Stream #\d+:\d+.*?: Video: (\w+)[^\n]*", out)
    if m:
        line = m.group(0)
        info["video"]["codec_name"] = m.group(1)
        d = re.search(r"(?<![\d])(\d{2,5})x(\d{2,5})(?![\d])", line)
        if d:
            info["video"]["width"], info["video"]["height"] = d.group(1), d.group(2)
        f = re.search(r"([\d.]+) fps", line)
        if f:
            fps = float(f.group(1))
            info["video"]["r_frame_rate"] = (f"{int(round(fps))}/1"
                                             if abs(fps - round(fps)) < 1e-6
                                             else f"{int(round(fps*1000))}/1000")

    m = re.search(r"Stream #\d+:\d+.*?: Audio: (\w+)[^\n]*", out)
    if m:
        line = m.group(0)
        info["audio"]["codec_name"] = m.group(1)
        s = re.search(r"(\d+) Hz", line)
        if s:
            info["audio"]["sample_rate"] = s.group(1)
        if "stereo" in line:
            info["audio"]["channels"] = "2"
        elif "mono" in line:
            info["audio"]["channels"] = "1"
    return info


def main(argv):
    args = argv[1:]
    entries, fmt, path, streams = None, "default", None, None
    i = 0
    while i < len(args):
        a = args[i]
        if a == "-show_entries":
            entries = args[i + 1]; i += 2
        elif a == "-of":
            fmt = args[i + 1]; i += 2
        elif a == "-select_streams":
            streams = args[i + 1]; i += 2
        elif a in ("-v", "-loglevel", "-hide_banner"):
            i += 2 if a != "-hide_banner" else 1
        elif a == "-version":
            print("ffprobe shim (ffmpeg -i parser) -- not the real ffprobe")
            return 0
        else:
            path = a; i += 1

    if not path or not entries:
        sys.stderr.write("ffprobe shim: need a file and -show_entries\n")
        return 2

    info = probe(path)
    want_audio = bool(streams and streams.startswith("a"))

    values = []
    for group in entries.split(":"):
        section, _, fields = group.partition("=")
        for field in fields.split(","):
            if not field:
                continue
            if section == "format":
                v = info["format"].get(field)
            else:
                src = info["audio"] if want_audio else info["video"]
                v = src.get(field) or info["audio"].get(field)
            if v is None:
                sys.stderr.write(
                    f"ffprobe shim: cannot answer '{section}={field}' for "
                    f"{path}. This is a stand-in covering only what this "
                    f"repository asks for; install a real ffprobe.\n")
                return 3
            values.append((field, v))

    if fmt.startswith("csv"):
        sep = "x" if "s=x" in fmt else ","
        print(sep.join(v for _k, v in values))
    else:                                   # default=...
        nk = "nk=1" in fmt
        for k, v in values:
            print(v if nk else f"{k}={v}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

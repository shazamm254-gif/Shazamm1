#!/usr/bin/env bash
#
# rank.sh -- build a YouTube Shorts countdown video from five clips.
#
#   ./rank.sh <folder>
#
# The folder holds five clips named "<rank>_<label>.mp4", where rank is 1-5
# and the label is whatever you want on screen:
#
#   5_Raccoon Cashier.mp4   4_Goose Security.mp4   ...   1_Cat Surgeon.mp4
#
# plus title.txt, two lines:
#
#   RANKING ANIMALS
#   DOING HUMAN JOBS
#
# Optional in the same folder:
#   trims.txt      one line per override: "<rank> <start> <duration>"
#                  e.g. "5 1.5 6" -- take 6s from 1.5s into clip 5
#   voiceover.mp3  mixed over the top, clip audio ducked underneath
#
# Out:
#   final.mp4      1080x1920, 30fps, H.264 / AAC, -14 LUFS, faststart
#   contact.jpg    one overlaid frame per clip, so you can see at a glance
#                  whether the title bar or the tracker is sitting on a face
#
# The overlays are drawn once per clip as full-frame PNGs and composited,
# rather than as a stack of drawtext filters. Each label has three states
# across the video -- hidden, live, revealed -- and the state only ever
# changes at a clip boundary, so five images express the whole thing and
# the filter graph stays readable enough to debug.

set -euo pipefail

# ---------------------------------------------------------------- settings
W=1080; H=1920; FPS=30
DEF_START=1.0            # seconds skipped at the head of each clip
DEF_DUR=6.0              # seconds kept

BAR_Y=60; BAR_H=225      # white title bar
TITLE_PX=81
C_LINE1="#000000"
C_LINE2="#E63946"

ROW_Y=318; ROW_STEP=69   # rank tracker, rows 1..5 top-down
NUM_PX=51; NUM_X=33; NUM_STROKE=6
LAB_PX=46; LAB_X=99
C_NUM="#FFFFFF"
C_LIVE="#FFD60A"         # label while its own clip is playing
C_DONE="#FFFFFF"         # label for the rest of the video

# Labels sit on moving video, so they get the same treatment as the numbers.
# The brief only specified a border on the numbers; set this to 0 if you
# want the labels bare.
LAB_STROKE=5

LUFS=-14; TRUE_PEAK=-1.5
DUCK=0.30                # clip audio level under the voiceover

FONT_URL="https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf"

# ---------------------------------------------------------------- arguments
if [ $# -ne 1 ]; then
  echo "usage: $(basename "$0") <folder>" >&2
  exit 2
fi
DIR="${1%/}"
[ -d "$DIR" ] || { echo "not a folder: $DIR" >&2; exit 1; }

command -v ffmpeg  >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe not found" >&2; exit 1; }
python3 -c "import PIL" 2>/dev/null || { echo "python3 Pillow not found: pip install Pillow" >&2; exit 1; }

TITLE_FILE="$DIR/title.txt"
[ -f "$TITLE_FILE" ] || { echo "missing $TITLE_FILE (two lines)" >&2; exit 1; }
LINE1=$(sed -n '1p' "$TITLE_FILE")
LINE2=$(sed -n '2p' "$TITLE_FILE")
[ -n "$LINE1" ] || { echo "title.txt line 1 is empty" >&2; exit 1; }

# ---------------------------------------------------------------- the font
FONT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/fonts"
FONT="$FONT_DIR/Poppins-Bold.ttf"
if [ ! -s "$FONT" ]; then
  mkdir -p "$FONT_DIR"
  echo "Poppins Bold not found, downloading..."
  if command -v curl >/dev/null; then
    curl -fsSL --max-time 60 -o "$FONT" "$FONT_URL" || true
  elif command -v wget >/dev/null; then
    wget -q -T 60 -O "$FONT" "$FONT_URL" || true
  fi
  if [ ! -s "$FONT" ] || [ "$(stat -c%s "$FONT" 2>/dev/null || echo 0)" -lt 40000 ]; then
    rm -f "$FONT"
    echo "Could not download Poppins Bold." >&2
    echo "Put a copy at: $FONT" >&2
    echo "  $FONT_URL" >&2
    exit 1
  fi
  echo "  -> $FONT"
fi

# ---------------------------------------------------------------- the clips
# Ranks 1-5, played 5 first. Labels come from the filename, so they may
# contain spaces -- everything below stays quoted.
declare -A CLIP LABEL START DUR
for rank in 1 2 3 4 5; do
  found=""
  for f in "$DIR"/"${rank}"_*; do
    [ -e "$f" ] || continue
    case "${f##*.}" in
      mp4|MP4|mov|MOV|m4v|M4V|webm|WEBM|mkv|MKV) found="$f"; break ;;
    esac
  done
  [ -n "$found" ] || { echo "no clip found for rank $rank (expected ${rank}_<label>.mp4)" >&2; exit 1; }
  CLIP[$rank]="$found"
  base="$(basename "$found")"; base="${base%.*}"
  LABEL[$rank]="${base#*_}"
  START[$rank]="$DEF_START"
  DUR[$rank]="$DEF_DUR"
done

if [ -f "$DIR/trims.txt" ]; then
  while read -r r s d _rest; do
    case "$r" in ''|\#*) continue ;; esac
    case "$r" in 1|2|3|4|5) ;; *) echo "trims.txt: ignoring rank '$r'" >&2; continue ;; esac
    [ -n "${s:-}" ] && START[$r]="$s"
    [ -n "${d:-}" ] && DUR[$r]="$d"
  done < "$DIR/trims.txt"
  echo "applied trims.txt"
fi

# A clip can be shorter than the window asked of it; clamp rather than
# letting ffmpeg silently hand back a short segment that desyncs the
# overlay timings from the picture.
for rank in 5 4 3 2 1; do
  len=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "${CLIP[$rank]}" 2>/dev/null || echo 0)
  avail=$(python3 -c "print(max(0.0, $len - ${START[$rank]}))")
  short=$(python3 -c "print(1 if $avail + 0.02 < ${DUR[$rank]} else 0)")
  if [ "$short" = "1" ]; then
    echo "  ! rank $rank: only ${avail}s after a ${START[$rank]}s skip, wanted ${DUR[$rank]}s -- using ${avail}s"
    DUR[$rank]="$avail"
  fi
done

BUILD="$(mktemp -d "${TMPDIR:-/tmp}/rank.XXXXXX")"
cleanup(){ [ "${KEEP_BUILD:-0}" = "1" ] || rm -rf "$BUILD"; }
trap cleanup EXIT

echo
echo "$LINE1 / $LINE2"
ORDER=(5 4 3 2 1)
for rank in "${ORDER[@]}"; do
  printf "  #%s  %-28s %ss from %ss\n" "$rank" "${LABEL[$rank]}" "${DUR[$rank]}" "${START[$rank]}"
done
echo

# ---------------------------------------------------------------- segments
i=0; TIMES=(); acc=0
: > "$BUILD/list.txt"
for rank in "${ORDER[@]}"; do
  seg="$BUILD/seg_$i.mp4"
  # -ss before -i seeks fast; re-encoding anyway so the frame-accurate
  # cost is already paid. anullsrc covers clips with no audio track, which
  # would otherwise break the concat.
  ffmpeg -y -v error -ss "${START[$rank]}" -i "${CLIP[$rank]}" \
    -f lavfi -t "${DUR[$rank]}" -i anullsrc=channel_layout=stereo:sample_rate=48000 \
    -filter_complex "[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,format=yuv420p[v]" \
    -map "[v]" -map 0:a? -map 1:a \
    -filter_complex_threads 1 \
    -t "${DUR[$rank]}" -c:v libx264 -preset medium -crf 18 \
    -c:a aac -b:a 192k -ar 48000 -ac 2 \
    -shortest -video_track_timescale 90000 \
    -map_metadata -1 "$seg" 2>"$BUILD/err_$i.txt" || {
      # clip had no audio stream: map 0:a? produced nothing, retry on silence
      ffmpeg -y -v error -ss "${START[$rank]}" -i "${CLIP[$rank]}" \
        -f lavfi -t "${DUR[$rank]}" -i anullsrc=channel_layout=stereo:sample_rate=48000 \
        -filter_complex "[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,format=yuv420p[v]" \
        -map "[v]" -map 1:a -t "${DUR[$rank]}" \
        -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k -ar 48000 -ac 2 \
        -video_track_timescale 90000 -map_metadata -1 "$seg"
    }
  real=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$seg")
  acc=$(python3 -c "print(round($acc + $real, 3))")
  TIMES+=("$acc")
  printf "file '%s'\n" "$seg" >> "$BUILD/list.txt"
  echo "  [$((i+1))/5] #$rank ${LABEL[$rank]} -> ${real}s"
  i=$((i+1))
done

ffmpeg -y -v error -f concat -safe 0 -i "$BUILD/list.txt" -c copy "$BUILD/joined.mp4"
TOTAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$BUILD/joined.mp4")
echo "  joined: ${TOTAL}s"

# ---------------------------------------------------------------- overlays
# One RGBA frame per clip. Everything reaches Python through a JSON file
# rather than argv or the environment, so a label containing quotes,
# apostrophes or non-ASCII survives the trip intact.
{
  printf '{\n'
  printf '  "font": %s,\n'  "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$FONT")"
  printf '  "line1": %s,\n' "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$LINE1")"
  printf '  "line2": %s,\n' "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$LINE2")"
  printf '  "labels": {'
  sep=""
  for r in 1 2 3 4 5; do
    printf '%s"%s": %s' "$sep" "$r" \
      "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "${LABEL[$r]}")"
    sep=", "
  done
  printf '},\n'
  printf '  "W": %s, "H": %s,\n' "$W" "$H"
  printf '  "BAR_Y": %s, "BAR_H": %s, "TITLE_PX": %s,\n' "$BAR_Y" "$BAR_H" "$TITLE_PX"
  printf '  "ROW_Y": %s, "ROW_STEP": %s,\n' "$ROW_Y" "$ROW_STEP"
  printf '  "NUM_PX": %s, "NUM_X": %s, "NUM_STROKE": %s,\n' "$NUM_PX" "$NUM_X" "$NUM_STROKE"
  printf '  "LAB_PX": %s, "LAB_X": %s, "LAB_STROKE": %s,\n' "$LAB_PX" "$LAB_X" "$LAB_STROKE"
  printf '  "C_LINE1": "%s", "C_LINE2": "%s",\n' "$C_LINE1" "$C_LINE2"
  printf '  "C_NUM": "%s", "C_LIVE": "%s", "C_DONE": "%s"\n' "$C_NUM" "$C_LIVE" "$C_DONE"
  printf '}\n'
} > "$BUILD/cfg.json"

python3 - "$BUILD" <<'PYEOF'
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

build = sys.argv[1]
cfg = json.load(open(os.path.join(build, "cfg.json"), encoding="utf-8"))
labels, line1, line2 = cfg["labels"], cfg["line1"], cfg["line2"]
fontpath = cfg["font"]

W, H = cfg["W"], cfg["H"]
BAR_Y, BAR_H, TITLE_PX = cfg["BAR_Y"], cfg["BAR_H"], cfg["TITLE_PX"]
ROW_Y, ROW_STEP = cfg["ROW_Y"], cfg["ROW_STEP"]
NUM_PX, NUM_X, NUM_STROKE = cfg["NUM_PX"], cfg["NUM_X"], cfg["NUM_STROKE"]
LAB_PX, LAB_X, LAB_STROKE = cfg["LAB_PX"], cfg["LAB_X"], cfg["LAB_STROKE"]
C_LINE1, C_LINE2 = cfg["C_LINE1"], cfg["C_LINE2"]
C_NUM, C_LIVE, C_DONE = cfg["C_NUM"], cfg["C_LIVE"], cfg["C_DONE"]

f_num = ImageFont.truetype(fontpath, NUM_PX)
f_lab = ImageFont.truetype(fontpath, LAB_PX)

# The title is centred in a full-width bar, so a long line would simply run
# off both edges with nothing to stop it. Shrink to fit instead, and say so,
# because a silently smaller title is the kind of thing you only notice
# after uploading.
def fit_title(lines, px, margin=56):
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    size = px
    while size > 24:
        f = ImageFont.truetype(fontpath, size)
        if all(probe.textbbox((0, 0), s, font=f)[2] <= W - 2 * margin for s in lines if s):
            return f, size
        size -= 2
    return ImageFont.truetype(fontpath, 24), 24

f_title, title_px = fit_title([line1, line2], TITLE_PX)
if title_px != TITLE_PX:
    print(f"  ! title too wide at {TITLE_PX}px, shrunk to {title_px}px to fit")

def centred(d, text, font, cy, fill):
    l, t, r, b = d.textbbox((0, 0), text, font=font)
    d.text(((W - (r - l)) / 2 - l, cy - (b - t) / 2 - t), text, font=font, fill=fill)

order = [5, 4, 3, 2, 1]          # play order; rank 5 is revealed first
widest = 0

for step, live in enumerate(order):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # title bar: two lines centred as a block inside the white box
    # rectangle() is inclusive of both corners, hence the -1: without it the
    # bar comes out 226px for a 225px setting.
    d.rectangle([0, BAR_Y, W - 1, BAR_Y + BAR_H - 1], fill="#FFFFFF")
    lead = int(title_px * 1.06)
    mid = BAR_Y + BAR_H / 2
    centred(d, line1, f_title, mid - lead / 2, C_LINE1)
    if line2:
        centred(d, line2, f_title, mid + lead / 2, C_LINE2)

    # tracker: rows 1..5 top-down. A rank is revealed once its clip has
    # started, which in play order means it is at or before this step.
    revealed = set(order[:step + 1])
    for row, rank in enumerate([1, 2, 3, 4, 5]):
        y = ROW_Y + row * ROW_STEP
        d.text((NUM_X, y), f"{rank}.", font=f_num, fill=C_NUM,
               stroke_width=NUM_STROKE, stroke_fill="#000000")
        if rank in revealed:
            colour = C_LIVE if rank == live else C_DONE
            text = labels[str(rank)]
            d.text((LAB_X, y + (NUM_PX - LAB_PX) // 2), text, font=f_lab, fill=colour,
                   stroke_width=LAB_STROKE, stroke_fill="#000000")
            r = d.textbbox((LAB_X, 0), text, font=f_lab, stroke_width=LAB_STROKE)[2]
            widest = max(widest, r)

    img.save(os.path.join(build, f"ov_{step}.png"))

if widest > W:
    print(f"  ! a label runs {widest - W}px past the right edge -- shorten it", file=sys.stderr)
elif widest > W * 0.92:
    print(f"  ! longest label reaches {widest}px of {W} -- close to the edge")
PYEOF

# ---------------------------------------------------------------- composite
FC=""; prev="[0:v]"
for n in 0 1 2 3 4; do
  from="0"; [ "$n" -gt 0 ] && from="${TIMES[$((n-1))]}"
  to="${TIMES[$n]}"
  FC="${FC}${prev}[$((n+1)):v]overlay=0:0:enable='between(t,${from},${to})'[vo${n}];"
  prev="[vo${n}]"
done
FC="${FC%;}"
FC="${FC/\[vo4\]/[vout]}"

ffmpeg -y -v error -i "$BUILD/joined.mp4" \
  -i "$BUILD/ov_0.png" -i "$BUILD/ov_1.png" -i "$BUILD/ov_2.png" \
  -i "$BUILD/ov_3.png" -i "$BUILD/ov_4.png" \
  -filter_complex "$FC" -map "[vout]" -map 0:a \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a copy "$BUILD/overlaid.mp4"
echo "  overlays composited"

# ---------------------------------------------------------------- audio
VO="$DIR/voiceover.mp3"
if [ -f "$VO" ]; then
  PCT=$(python3 -c "print(int($DUCK*100))")
  echo "  voiceover found -- ducking clip audio to ${PCT}%"

  # Rather than a sidechain compressor, whose depth depends on how loud the
  # voiceover happens to be, find where the voiceover is actually speaking
  # and drop the clip audio to exactly DUCK over those spans. Deterministic,
  # and it still lifts back between phrases.
  ENABLE=$(ffmpeg -hide_banner -nostats -i "$VO" \
             -af "silencedetect=noise=-40dB:d=0.35" -f null - 2>&1 \
           | python3 -c "
import sys, re, subprocess
txt = sys.stdin.read()
dur = float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration',
      '-of','csv=p=0','$VO'], capture_output=True, text=True).stdout.strip())
sil = []
start = None
for line in txt.splitlines():
    m = re.search(r'silence_start: ([\d.]+)', line)
    if m: start = float(m.group(1))
    m = re.search(r'silence_end: ([\d.]+)', line)
    if m and start is not None:
        sil.append((start, float(m.group(1)))); start = None
if start is not None:
    sil.append((start, dur))
# invert the silences to get speech spans
spans, cur = [], 0.0
for a, b in sil:
    if a - cur > 0.05: spans.append((cur, a))
    cur = b
if dur - cur > 0.05: spans.append((cur, dur))
if not spans: spans = [(0.0, dur)]
# merge anything separated by less than 0.4s; a duck that flutters is worse
# than one that stays down through a short breath
merged = [list(spans[0])]
for a, b in spans[1:]:
    if a - merged[-1][1] < 0.4: merged[-1][1] = b
    else: merged.append([a, b])
print('+'.join(f'between(t,{a:.3f},{b:.3f})' for a, b in merged))
" 2>/dev/null)
  NSPAN=$(echo "$ENABLE" | tr '+' '\n' | grep -c between || echo 1)
  echo "    ${NSPAN} voiceover span(s) detected"

  ffmpeg -y -v error -i "$BUILD/overlaid.mp4" -i "$VO" -filter_complex "
    [0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,
         volume=${DUCK}:enable='${ENABLE}'[cl];
    [1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,
         apad[vo];
    [cl][vo]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[mixed]" \
    -map 0:v -map "[mixed]" -c:v copy -c:a aac -b:a 192k "$BUILD/mixed.mp4"
  SRC="$BUILD/mixed.mp4"
else
  SRC="$BUILD/overlaid.mp4"
fi

# Two-pass loudnorm. A single pass undershoots badly when the correction
# is large, which is exactly the case with phone-recorded clip audio.
MEAS=$(ffmpeg -hide_banner -nostats -i "$SRC" \
        -af "loudnorm=I=${LUFS}:TP=${TRUE_PEAK}:LRA=11:print_format=json" \
        -f null - 2>&1 | sed -n '/{/,/}/p')
gv(){ echo "$MEAS" | grep "\"$1\"" | grep -oE '\-?[0-9.]+|inf' | head -1; }
MI=$(gv input_i); MTP=$(gv input_tp); MLRA=$(gv input_lra); MTH=$(gv input_thresh)

OUT="$DIR/final.mp4"
if [ -n "$MI" ] && [ "$MI" != "inf" ] && [ "$MI" != "-inf" ]; then
  ffmpeg -y -v error -i "$SRC" -c:v copy \
    -af "loudnorm=I=${LUFS}:TP=${TRUE_PEAK}:LRA=11:measured_I=${MI}:measured_TP=${MTP}:measured_LRA=${MLRA}:measured_thresh=${MTH}" \
    -c:a aac -b:a 192k -movflags +faststart "$OUT"
else
  echo "  ! could not measure loudness (silent audio?) -- copying through"
  ffmpeg -y -v error -i "$SRC" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT"
fi

# ---------------------------------------------------------------- contact
# One frame from the middle of each clip, taken from the finished video so
# the overlays are exactly as they will ship.
sheet_args=(); n=0
for rank in "${ORDER[@]}"; do
  from="0"; [ "$n" -gt 0 ] && from="${TIMES[$((n-1))]}"
  to="${TIMES[$n]}"
  mid=$(python3 -c "print(round(($from + $to)/2, 3))")
  ffmpeg -y -v error -ss "$mid" -i "$OUT" -frames:v 1 "$BUILD/f_$n.png"
  sheet_args+=("$BUILD/f_$n.png")
  n=$((n+1))
done
python3 - "$DIR/contact.jpg" "${sheet_args[@]}" <<'PYEOF'
import sys
from PIL import Image
out, paths = sys.argv[1], sys.argv[2:]
ims = [Image.open(p) for p in paths]
tw = 360
th = int(ims[0].height * tw / ims[0].width)
sheet = Image.new("RGB", (tw * len(ims), th), "black")
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (i * tw, 0))
sheet.save(out, quality=92)
PYEOF

# ---------------------------------------------------------------- report
FD=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
FI=$(ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=framelog=quiet -f null - 2>&1 \
      | grep -A1 "Integrated loudness" | grep "I:" | grep -oE '\-?[0-9.]+ LUFS' || true)
echo
echo "Done: $OUT"
echo "  ${FD}s   ${W}x${H} @ ${FPS}fps   ${FI:-loudness unknown}"
echo "  contact sheet: $DIR/contact.jpg"

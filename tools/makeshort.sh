#!/data/data/com.termux/files/usr/bin/bash
# makeshort.sh — assemble a finished Short from clips + a voiceover.
#
#   bash makeshort.sh [folder]
#
# Put the voiceover (.mp3/.m4a/.wav) and the clips (.mp4, named so they sort
# into running order — 01.mp4, 02.mp4 …) in one folder. Default ~/short.
#
# Clips are scaled and cropped to 1080x1920, joined, then stretched or trimmed
# so the picture lasts exactly as long as the narration. Output lands in your
# gallery.
set -euo pipefail

DIR="${1:-$HOME/short}"
W=1080; H=1920; FPS=30

[ -d "$DIR" ] || { echo "No such folder: $DIR"; exit 1; }

AUDIO="$(find "$DIR" -maxdepth 1 -type f \( -iname '*.mp3' -o -iname '*.m4a' -o -iname '*.wav' \) | sort | head -1)"
[ -n "$AUDIO" ] || { echo "No voiceover (.mp3/.m4a/.wav) found in $DIR"; exit 1; }

mapfile -t CLIPS < <(find "$DIR" -maxdepth 1 -type f -iname '*.mp4' ! -name 'SHORT-*' | sort)
[ "${#CLIPS[@]}" -gt 0 ] || { echo "No .mp4 clips found in $DIR"; exit 1; }

echo "Voiceover : $(basename "$AUDIO")"
echo "Clips     : ${#CLIPS[@]}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }

# 1. normalise every clip to identical format so they can be joined cleanly
i=0
for c in "${CLIPS[@]}"; do
  i=$((i+1))
  printf '  [%d/%d] %s\n' "$i" "${#CLIPS[@]}" "$(basename "$c")"
  ffmpeg -v error -y -i "$c" \
    -vf "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1" \
    -an -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
    "$WORK/$(printf '%03d' "$i").mp4"
done

# 2. join
: > "$WORK/list.txt"
for f in "$WORK"/[0-9][0-9][0-9].mp4; do echo "file '$f'" >> "$WORK/list.txt"; done
ffmpeg -v error -y -f concat -safe 0 -i "$WORK/list.txt" -c copy "$WORK/joined.mp4"

AD="$(dur "$AUDIO")"; VD="$(dur "$WORK/joined.mp4")"
FACTOR="$(python3 -c "print(f'{$AD/$VD:.6f}')")"
printf 'Narration : %.1fs\nPicture   : %.1fs\nFit       : %sx\n' "$AD" "$VD" "$FACTOR"

WARN="$(python3 -c "print('slow' if $FACTOR>2.0 else ('fast' if $FACTOR<0.5 else 'ok'))")"
[ "$WARN" = slow ] && echo "  NOTE: stretching more than 2x — consider more clips."
[ "$WARN" = fast ] && echo "  NOTE: picture much longer than narration — the tail is trimmed."

# 3. stretch (or compress) the picture to the narration's length
ffmpeg -v error -y -i "$WORK/joined.mp4" -filter:v "setpts=${FACTOR}*PTS" \
  -an -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "$WORK/fitted.mp4"

# 4. lay the narration under it
OUTNAME="SHORT-$(date +%Y%m%d-%H%M%S).mp4"
TMPOUT="$WORK/$OUTNAME"
ffmpeg -v error -y -i "$WORK/fitted.mp4" -i "$AUDIO" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest \
  -movflags +faststart "$TMPOUT"

# 5. save where the gallery can see it
DEST="$HOME/storage/movies"
[ -d "$DEST" ] || DEST="$DIR"
cp "$TMPOUT" "$DEST/$OUTNAME"

printf '\nDone: %s\n' "$DEST/$OUTNAME"
printf 'Length: %.1fs\n' "$(dur "$DEST/$OUTNAME")"

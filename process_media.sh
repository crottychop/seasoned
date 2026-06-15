#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# process_media.sh — turn raw family photos/videos into web-ready
# hero assets. Drop originals (phone .mov/.mp4, .jpg/.heic/.png)
# into raw-media/, then run:  ./process_media.sh
#
# Output → pictures/hero/  (committed; raw-media/ is gitignored)
#   • videos → muted, looping-friendly H.264 .mp4 (≤960px, +faststart)
#              + a .jpg poster (first frame) for fast first paint
#   • images → ≤1280px JPEG
# ─────────────────────────────────────────────────────────────
set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

SRC="raw-media"
OUT="pictures/hero"
mkdir -p "$OUT"
shopt -s nullglob nocaseglob

if [ -z "$(ls -A "$SRC" 2>/dev/null)" ]; then
  echo "⚠️  $SRC/ is empty — drop your family photos & cooking clips in there first."
  exit 0
fi

# Clean web transcode: downscale to ≤960px only — no color grade, grain, or
# vignette, so the hero plays natural, borderless footage. Clips are capped at
# 10s since the hero crossfades roughly every 7s.
GRADE="scale='min(960,iw)':-2:flags=lanczos,format=yuv420p"

echo "🎬 Transcoding videos (clean, ≤10s)…"
for f in "$SRC"/*.mov "$SRC"/*.mp4 "$SRC"/*.m4v "$SRC"/*.avi; do
  base="$(basename "${f%.*}")"
  out="$OUT/${base}.mp4"
  echo "   $f → $out"
  ffmpeg -nostdin -y -i "$f" \
    -t 10 -vf "$GRADE" \
    -an -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -crf 30 -preset slow -movflags +faststart \
    -hide_banner -loglevel error "$out"
  ffmpeg -nostdin -y -i "$out" -frames:v 1 -q:v 3 \
    -hide_banner -loglevel error "$OUT/${base}.jpg"
done

echo "🖼  Processing images…"
for f in "$SRC"/*.jpg "$SRC"/*.jpeg "$SRC"/*.png "$SRC"/*.heic; do
  base="$(basename "${f%.*}")"
  out="$OUT/${base}.jpg"
  # don't clobber a poster we just generated from a same-named video
  [ -f "$OUT/${base}.mp4" ] && out="$OUT/${base}-photo.jpg"
  echo "   $f → $out"
  sips -s format jpeg -Z 1280 "$f" --out "$out" >/dev/null
done

echo "✅ Done."
ls -lah "$OUT"

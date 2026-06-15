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

# Super-8 documentary grade: downscale, lifted warm shadows, lower contrast/sat,
# gentle vignette, moving film grain. Baked in so the look is consistent + survives
# the hero's dimming (a CSS overlay would wash out).
GRADE="scale='min(960,iw)':-2:flags=lanczos,curves=r='0/0.05 0.5/0.57 1/0.97':g='0/0.04 0.5/0.5 1/0.93':b='0/0.06 0.5/0.44 1/0.88',eq=contrast=0.93:saturation=0.90:gamma=1.02:brightness=0.015,colorbalance=rs=0.04:bs=-0.05:rm=0.05:bm=-0.04:rh=0.05:bh=-0.07,vignette=PI/5,noise=alls=11:allf=t+u,format=yuv420p"

echo "🎬 Transcoding + Super-8 grading videos…"
for f in "$SRC"/*.mov "$SRC"/*.mp4 "$SRC"/*.m4v "$SRC"/*.avi; do
  base="$(basename "${f%.*}")"
  out="$OUT/${base}.mp4"
  echo "   $f → $out"
  ffmpeg -nostdin -y -i "$f" \
    -vf "$GRADE" \
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

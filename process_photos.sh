#!/usr/bin/env bash
#
# process_photos.sh — turn a raw photo into a web-ready 900×600 JPEG for Seasoned.
#
# Usage:
#   ./process_photos.sh <input-image> <output-name>
#
#   <input-image>  Any JPG / PNG / HEIC (e.g. ~/Desktop/IMG_4521.HEIC).
#   <output-name>  Kebab-case name, no extension (e.g. dads-chili).
#
# Output:
#   pictures/processed/<output-name>.jpg   (900×600, center-cropped, ~150 KB)
#
# The original file is never modified. Uses macOS's built-in `sips` — no installs.

set -euo pipefail

TARGET_W=900
TARGET_H=600
QUALITY=80   # JPEG quality 0–100; 80 ≈ the ~150 KB of your existing photos

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <input-image> <output-name>"
  echo "Example: $0 ~/Desktop/IMG_4521.HEIC dads-chili"
  exit 1
fi

SRC="$1"
NAME="$2"

if [ ! -f "$SRC" ]; then
  echo "❌ Input file not found: $SRC"
  exit 1
fi

# Normalize the name: drop any extension, lowercase, spaces → dashes, strip junk.
NAME="${NAME%.*}"
NAME="$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
if [ -z "$NAME" ]; then
  echo "❌ Output name became empty after cleanup — pass something like 'dads-chili'."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST_DIR="$ROOT/pictures/processed"
mkdir -p "$DEST_DIR"
DEST="$DEST_DIR/$NAME.jpg"

# Work on a temp copy so the original is untouched; also converts HEIC → JPEG.
TMP="$(mktemp -t seasoned-photo).jpg"
trap 'rm -f "$TMP"' EXIT
sips -s format jpeg "$SRC" --out "$TMP" >/dev/null

# Read source dimensions.
W=$(sips -g pixelWidth  "$TMP" | awk '/pixelWidth/{print $2}')
H=$(sips -g pixelHeight "$TMP" | awk '/pixelHeight/{print $2}')

# Scale to *cover* the target box (preserving aspect), then center-crop to exactly
# 900×600. Compare the source aspect to the target aspect (900/600 = 1.5):
#   wider than target  → match height, crop the sides
#   taller than target → match width, crop top/bottom
if [ "$(( W * TARGET_H ))" -ge "$(( TARGET_W * H ))" ]; then
  sips --resampleHeight "$TARGET_H" "$TMP" >/dev/null
else
  sips --resampleWidth  "$TARGET_W" "$TMP" >/dev/null
fi
sips --cropToHeightWidth "$TARGET_H" "$TARGET_W" "$TMP" >/dev/null
sips -s formatOptions "$QUALITY" "$TMP" --out "$DEST" >/dev/null

SIZE="$(du -h "$DEST" | awk '{print $1}')"
DIMS="$(sips -g pixelWidth -g pixelHeight "$DEST" | awk '/pixelWidth|pixelHeight/{print $2}' | paste -sd'x' -)"
echo "✅ Created pictures/processed/$NAME.jpg  ($DIMS, $SIZE)"
echo "   Use in recipes.json as:  \"photo\": \"pictures/processed/$NAME.jpg\""

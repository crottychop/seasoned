#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# archive_iteration.sh "<short label>"
# Freezes the current iteration:
#   • git-tags the exact code  (iter-YYYY-MM-DD-<slug>)  — restorable forever
#   • creates archive/YYYY-MM-DD_<slug>/  for the visual record
#
# Screenshots: just ask Claude to "archive this" (it captures full-page
# home + recipes at desktop & mobile into the folder), or drop your own
# PNGs in. The archive/ folder is git-ignored (local only).
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

label="${1:-}"
[ -z "$label" ] && { echo 'usage: ./archive_iteration.sh "short label"'; exit 1; }

slug=$(printf '%s' "$label" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')
date=$(date +%Y-%m-%d)
dir="archive/${date}_${slug}"
tag="iter-${date}-${slug}"

mkdir -p "$dir"
if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "(tag $tag already exists — leaving it)"
else
  git tag -a "$tag" -m "$label" && echo "🏷  tagged $tag"
fi
echo "📁 $dir ready."
echo "   → ask Claude to 'archive this', or drop PNGs in here."

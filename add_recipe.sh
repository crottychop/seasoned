#!/usr/bin/env bash
#
# add_recipe.sh — interactively add a recipe (and its photo) to Seasoned.
#
# Walks you through each field, optionally processes a photo via
# process_photos.sh, auto-assigns the next id, appends the entry to
# data/recipes.json, and offers to publish (git commit + push).
#
# Usage:  ./add_recipe.sh
# Cancel anytime with Ctrl-C — nothing is saved until the final confirmation.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
JSON="$ROOT/data/recipes.json"
PROC="$ROOT/process_photos.sh"

echo "🫙  Add a recipe to Seasoned"
echo "    (Ctrl-C to cancel — nothing saves until you confirm at the end.)"
echo

read -rp "Title: " TITLE
read -rp "One-line description: " DESCRIPTION
read -rp "Cuisine (e.g. Italian): " CUISINE
read -rp "Category (e.g. Dinner): " CATEGORY
read -rp "Total minutes (number): " TOTALMINUTES
read -rp "Emoji (e.g. 🌶️ ): " EMOJI
read -rp "Serves (optional — blank to skip): " SERVES

echo
echo "Ingredients — one per line, blank line to finish:"
INGREDIENTS=()
while IFS= read -r line; do [ -z "$line" ] && break; INGREDIENTS+=("$line"); done

echo
echo "Instructions — one step per line, blank line to finish:"
INSTRUCTIONS=()
while IFS= read -r line; do [ -z "$line" ] && break; INSTRUCTIONS+=("$line"); done

echo
read -rp "Notes (the family story / tips, optional): " NOTES

echo
read -rp "Path to a photo (blank to skip): " PHOTOSRC
PHOTOREL=""
if [ -n "$PHOTOSRC" ]; then
  SLUG="$(printf '%s' "$TITLE" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
  "$PROC" "$PHOTOSRC" "$SLUG"
  PHOTOREL="pictures/processed/$SLUG.jpg"
fi

# Stash the list fields in temp files so we don't fight shell quoting in Python.
ING_FILE="$(mktemp)"; INS_FILE="$(mktemp)"
trap 'rm -f "$ING_FILE" "$INS_FILE"' EXIT
[ "${#INGREDIENTS[@]}"  -gt 0 ] && printf '%s\n' "${INGREDIENTS[@]}"  > "$ING_FILE"
[ "${#INSTRUCTIONS[@]}" -gt 0 ] && printf '%s\n' "${INSTRUCTIONS[@]}" > "$INS_FILE"

echo
echo "Adding to $JSON ..."

TITLE="$TITLE" DESCRIPTION="$DESCRIPTION" CUISINE="$CUISINE" CATEGORY="$CATEGORY" \
TOTALMINUTES="$TOTALMINUTES" EMOJI="$EMOJI" SERVES="$SERVES" NOTES="$NOTES" \
PHOTOREL="$PHOTOREL" \
python3 - "$JSON" "$ING_FILE" "$INS_FILE" <<'PY'
import json, os, sys

json_path, ing_path, ins_path = sys.argv[1], sys.argv[2], sys.argv[3]

with open(json_path, encoding="utf-8") as f:
    data = json.load(f)

new_id = max((r["id"] for r in data), default=0) + 1

def lines(path):
    try:
        with open(path, encoding="utf-8") as f:
            return [ln.rstrip("\n") for ln in f if ln.strip()]
    except FileNotFoundError:
        return []

try:
    minutes = int(os.environ["TOTALMINUTES"])
except ValueError:
    minutes = os.environ["TOTALMINUTES"]  # keep whatever was typed if not a number

entry = {
    "id": new_id,
    "title": os.environ["TITLE"],
    "description": os.environ["DESCRIPTION"],
    "cuisine": os.environ["CUISINE"],
    "category": os.environ["CATEGORY"],
    "totalMinutes": minutes,
    "emoji": os.environ["EMOJI"],
    "photo": os.environ.get("PHOTOREL", ""),
    "ingredients": lines(ing_path),
    "instructions": lines(ins_path),
    "notes": os.environ.get("NOTES", ""),
}

# Insert optional `serves` right after `photo`, matching existing entries' order.
serves = os.environ.get("SERVES", "").strip()
if serves:
    rebuilt = {}
    for k, v in entry.items():
        rebuilt[k] = v
        if k == "photo":
            rebuilt["serves"] = serves
    entry = rebuilt

data.append(entry)

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"✅ Added #{new_id}: {entry['title']}  ({len(entry['ingredients'])} ingredients, "
      f"{len(entry['instructions'])} steps)")
PY

echo
read -rp "Publish now (git commit + push)? [y/N]: " PUBLISH
if [[ "$PUBLISH" =~ ^[Yy]$ ]]; then
  cd "$ROOT"
  git add data/recipes.json pictures/processed >/dev/null 2>&1 || git add data/recipes.json
  git commit -m "Add recipe: $TITLE" >/dev/null
  git push
  echo "🚀 Pushed. Live site updates in ~1 minute: https://crottychop.github.io/family-cookbook/"
else
  echo "Saved locally. When ready, run:  git add -A && git commit -m \"Add $TITLE\" && git push"
fi

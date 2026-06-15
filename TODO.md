# Seasoned — Launch To-Do

_Last updated: 2026-06-15_

Goal: get the cookbook website fully up and running.

---

## 🎬 Landing-page media
- [ ] **Finalize the B-roll footage montage** for the hero/landing page
  - [ ] Lock the final clip selection (currently 6 curated portrait clips in `pictures/hero/`)
  - [ ] Decide if the 2 dropped clips (shrimp/dark, plating) come back or stay cut
  - [ ] Drop any new raw clips into `raw-media/` and run `./process_media.sh` (auto-applies the Super-8 grade)
  - [ ] Review crossfade timing / order on desktop + mobile
  - [ ] Push the local hero redesign (still LOCAL ONLY — not yet pushed)

## 📸 Recipe content & photos
- [ ] **Comb through phone** for more recipe photos worth adding
  - [ ] Pull the keepers into `jpg pictures/` (full-size originals)
  - [ ] Run each through `./add_recipe.sh` (processes photo + appends to `recipes.json`)
- [ ] **Source raw ingredient images**
  - [ ] Review the current Wikipedia / open-source ingredient shots
  - [ ] For any you don't like → source replacements from **Adobe Stock**
  - [ ] Process + swap them in

## 🎨 Homepage design & interactions
- [ ] **Finalize the homepage design** and lock all interactions
  - [ ] Drop the real logo into the "LOGO GOES HERE" wordmark slot in `index.html` (still a placeholder)
  - [ ] Final pass on layout, spacing, and the pill/chip system
  - [ ] Verify every interaction (filters, modal, footer chip-links, hover states)
  - [ ] Archive the final iteration: `./archive_iteration.sh "<label>"`

## ✅ Recipe status indicator (needs Najeer)
- [ ] **Design a "final" vs "pending" indicator** for recipes
  - [ ] Decide the visual (icon / badge / pill) for finalized vs in-progress
  - [ ] Add a `status` field to the recipe schema in `data/recipes.json`
  - [ ] Render the indicator on recipe cards (and/or the detail modal)
  - [ ] **Coordinate with Najeer** on this piece

## 🥫 Pantry / inventory
- [x] **Pantry tracker** — new `pantry` view: tap items you're out of; recipes subtly flag out-of-stock ingredients (dim + red dot). Keyed by ingredient cut-out slug. Local (localStorage) for now.
- [ ] **Make it shared/live** — create a Firebase Realtime DB and paste the config into `window.SEASONED_FIREBASE` in `index.html` (setup steps in chat) so the whole family syncs in real time.
- [ ] **"What can we make?"** — a view/filter that surfaces every recipe makeable from the *current pantry* (all ingredients in stock). Bonus: a "missing only 1–2" near-match list. Natural extension — the per-ingredient in/out-of-stock check already exists.
- [ ] **Pantry staples not tied to a recipe** (oil, soy sauce, garlic, mirin…) via a small master-items list, so the pantry isn't limited to recipe ingredients.
- [ ] _(optional)_ Group the pantry into **Fridge · Freezer · Pantry** sections.

## 🚀 Launch
- [ ] Final QA pass across desktop (1440) + mobile (390)
- [ ] Push to `main` → confirm live at https://crottychop.github.io/seasoned/

# Seasoned 🫙

> *Food is how we say I love you. This is where we keep the receipts.*

**Seasoned** is our living archive — the recipes we grew up making, the restaurants we discovered together, the flavors we can't stop talking about. Part cookbook, part memory wall, part game. Built by us, for us, and everyone who's ever sat at our table.

### 🌐 [**Open the live cookbook →**](https://crottychop.github.io/family-cookbook/)

No setup needed — works on any phone or computer.

---

## What's inside

| Feature | Status |
|---|---|
| 🍳 Recipe browser with search & filters | ✅ Live |
| 🎮 Cooking mini-game — drag ingredients into the pot | 🚧 Coming soon |
| 🍽️ Restaurant memories — every meal we've shared out in the world | 🚧 Coming soon |
| 📅 Cook log — track every time someone makes a family recipe | 🚧 Coming soon |

---

## The recipes

Every recipe lives in `data/recipes.json`. Each one has a title, description, ingredients, step-by-step instructions, cook time, cuisine, category, and a `notes` field — that's where the good stuff goes: family memories, tips passed down, the thing Grandma always said.

**To add a new recipe**, open `data/recipes.json` and add an entry at the end:

```json
{
  "id": 8,
  "title": "Dad's Chili",
  "description": "One line that makes someone want to eat it.",
  "cuisine": "American",
  "category": "Dinner",
  "totalMinutes": 60,
  "emoji": "🌶️",
  "ingredients": [
    "2 lbs ground beef",
    "1 can kidney beans",
    "1 can crushed tomatoes"
  ],
  "instructions": [
    "Brown the beef in a large pot.",
    "Add everything else. Simmer 45 minutes.",
    "Taste. Argue about whether it needs more chili powder."
  ],
  "notes": "Dad's secret: a square of dark chocolate stirred in at the end."
}
```

A few rules:
- `"id"` must be unique — just use the next number in the list
- `"cuisine"` and `"category"` feed the filter dropdowns automatically, so use consistent names (e.g., always `"Italian"`, not `"italian"` or `"Italian-American"`)
- The `"notes"` field is optional but encouraged — this is where the recipe becomes *ours*

---

## Coming soon: The cooking mini-game 🎮

Pick a recipe, and the ingredients appear scattered on a kitchen counter. Drag them one by one into the pot. Get them all in, hit cook, and watch it come to life. A fun way to test how well you actually know a dish — or introduce the recipes to kids.

The goal is for the game to be recipe-aware, so playing it for Grandma's Chicken Soup gives you exactly those ingredients to work with.

---

## Coming soon: Restaurant memories 🍽️

A separate tab dedicated to every meal we've shared together outside the kitchen — the birthday dinners, the vacation spots, the random places that became traditions. Each entry will have:

- Restaurant name & location
- When we went and who was there
- What we ordered (and what we'd order again)
- A photo if we have one

This isn't a review site — it's a memory wall. The kind of thing you scroll through and think *oh I forgot about that place.*

---

## Coming soon: The cook log 📅

Every time someone makes a family recipe, they can log it. Over time, it builds a picture — who makes Mom's lasagna the most, which recipe gets cooked every Christmas without fail, which one hasn't been touched in years and probably needs a revival.

Entries will be simple: recipe, who cooked it, date, and an optional note ("made it for the first time solo — turned out great").

---

## Running locally

The app fetches `data/recipes.json`, so you need a local server rather than opening `index.html` directly.

**Option 1 — Python (no install needed):**
```bash
# from inside the project folder
python3 -m http.server 8080
# Open http://localhost:8080
```

**Option 2 — VS Code:**
Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension, open the folder, and click **Go Live** in the bottom bar.

**Option 3 — Node.js:**
```bash
npx serve .
```

---

## Deploying (sharing the link with everyone)

✅ **Already live via GitHub Pages:** https://crottychop.github.io/family-cookbook/
Every push to `main` updates the site automatically within a minute.

This is a plain static site — no build step, no backend. Any of these work for free:

| Platform | How |
|---|---|
| **GitHub Pages** | Push to `main`, go to repo Settings → Pages → Source: main / root |
| **Netlify** | Drag the project folder onto [netlify.com/drop](https://netlify.com/drop) |
| **Vercel** | Run `npx vercel` from the project folder |

Once it's deployed, anyone in the family can open the link on their phone — no app store, no account needed.

---

## Project structure

```
seasoned/
├── index.html          # The app shell — tabs, filters, modal
├── css/
│   └── styles.css      # All styling
├── js/
│   └── app.js          # Recipe loading, filtering, rendering, modal
├── data/
│   └── recipes.json    # All recipes live here — edit this to add new ones
└── pictures/           # Recipe photos (optional, referenced in recipe entries)
```

---

## The vision

Seasoned is meant to grow with us. Right now it's recipes — but the bigger idea is that it holds *everything* about how our family relates to food: what we cook at home, where we go out, who taught us what, and the memories woven into every dish.

If you want to add something — a recipe, a restaurant memory, a feature idea — open an issue or just send a message. This is everyone's.

*Made with love. Seasoned with time.*

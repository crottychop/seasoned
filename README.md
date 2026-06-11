# The Family Cookbook

An interactive family recipe website — filterable by cuisine, category, and cook time.

## Adding a recipe

Open `data/recipes.json` and add a new entry following this shape:

```json
{
  "id": 7,
  "title": "Recipe Name",
  "description": "One sentence description.",
  "cuisine": "Italian",
  "category": "Dinner",
  "totalMinutes": 45,
  "emoji": "🍕",
  "ingredients": [
    "ingredient 1",
    "ingredient 2"
  ],
  "instructions": [
    "Step one.",
    "Step two."
  ],
  "notes": "Optional tip or family memory."
}
```

Make sure `"id"` is unique. Cuisine and category values feed the filter dropdowns automatically.

## Running locally

Because the app fetches `data/recipes.json`, you need a local server (not just opening `index.html` directly):

```bash
# Python 3
python3 -m http.server 8080
# then open http://localhost:8080
```

Or install the VS Code extension **Live Server** and click "Go Live".

## Deploying

This is a static site — no build step needed. Deploy to any of these for free:

- **GitHub Pages** — push to `main`, enable Pages in repo Settings → Pages → Source: main / root
- **Netlify** — drag the project folder onto netlify.com/drop
- **Vercel** — `npx vercel` from the project directory

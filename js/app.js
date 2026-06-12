let allRecipes = [];

// ── Load data ──────────────────────────────────────────
async function loadRecipes() {
  const res = await fetch('data/recipes.json');
  allRecipes = await res.json();
  populateFilters();
  renderGrid(allRecipes);
}

// ── Populate filter dropdowns from data ───────────────
function populateFilters() {
  const cuisines  = [...new Set(allRecipes.map(r => r.cuisine))].sort();
  const categories = [...new Set(allRecipes.map(r => r.category))].sort();

  fillSelect('cuisine', cuisines);
  fillSelect('category', categories);
}

function fillSelect(id, values) {
  const sel = document.getElementById(id);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

// ── Filter logic ──────────────────────────────────────
function getFiltered() {
  const query    = document.getElementById('search').value.toLowerCase().trim();
  const cuisine  = document.getElementById('cuisine').value;
  const maxTime  = parseInt(document.getElementById('time').value) || Infinity;
  const category = document.getElementById('category').value;

  return allRecipes.filter(r => {
    const matchesQuery = !query ||
      r.title.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query) ||
      r.ingredients.some(i => i.toLowerCase().includes(query));

    const matchesCuisine  = !cuisine  || r.cuisine  === cuisine;
    const matchesTime     = r.totalMinutes <= maxTime;
    const matchesCategory = !category || r.category === category;

    return matchesQuery && matchesCuisine && matchesTime && matchesCategory;
  });
}

// ── Render ────────────────────────────────────────────
function renderGrid(recipes) {
  const grid = document.getElementById('recipe-grid');
  const count = document.getElementById('result-count');

  count.textContent = recipes.length === allRecipes.length
    ? `${recipes.length} recipes`
    : `${recipes.length} of ${allRecipes.length} recipes`;

  if (recipes.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No recipes match your filters.</p></div>`;
    return;
  }

  grid.innerHTML = recipes.map(recipe => `
    <article class="recipe-card" data-id="${recipe.id}" tabindex="0" role="button"
             aria-label="Open ${recipe.title}">
      ${recipe.photo
        ? `<img class="recipe-card-img" src="${recipe.photo}" alt="${recipe.title}" loading="lazy" />`
        : `<div class="recipe-card-img"></div>`}
      <div class="recipe-card-body">
        <h2 class="recipe-card-title">${recipe.title}</h2>
        <p class="recipe-card-tags">${recipe.cuisine}, ${recipe.category}, ${formatTime(recipe.totalMinutes)}</p>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', () => openModal(parseInt(card.dataset.id)));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openModal(parseInt(card.dataset.id));
    });
  });
}

function formatTime(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ── Modal ─────────────────────────────────────────────
function openModal(id) {
  const recipe = allRecipes.find(r => r.id === id);
  if (!recipe) return;

  const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;
  const hasInstructions = recipe.instructions && recipe.instructions.length > 0;
  const hasNotes = recipe.notes &&
    recipe.notes !== 'Recipe to be filled in.' &&
    !recipe.notes.startsWith('Recipe to be filled in');

  document.getElementById('modal-content').innerHTML = `
    <div class="recipe-view">

      <div class="recipe-view-header">
        <p class="recipe-view-category">${recipe.category}</p>
        <h2 class="recipe-view-title">${recipe.title}</h2>
        <p class="recipe-view-desc">${recipe.description}</p>
        <div class="recipe-view-pills">
          <span class="recipe-pill">${formatTime(recipe.totalMinutes)}</span>
          ${recipe.serves ? `<span class="recipe-pill">Serves ${recipe.serves}</span>` : ''}
        </div>
      </div>

      ${recipe.photo ? `
      <div class="recipe-gallery">
        <img src="${recipe.photo}" alt="${recipe.title}" />
      </div>` : ''}

      <div class="recipe-view-body">
        <div>
          <div class="recipe-col-head"><h3>Ingredients</h3></div>
          ${hasIngredients
            ? `<ul class="ingredient-list">${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>`
            : `<p class="recipe-col-empty">Ingredients coming soon.</p>`}
        </div>
        <div>
          <div class="recipe-col-head"><h3>Method</h3></div>
          ${hasInstructions
            ? `<ol class="method-steps">${recipe.instructions.map((s, i) =>
                `<li><span class="step-num">${i + 1}</span><p class="step-text">${s}</p></li>`
              ).join('')}</ol>`
            : `<p class="recipe-col-empty">Method coming soon.</p>`}
        </div>
      </div>

      ${hasNotes ? `<p class="recipe-view-notes">${recipe.notes}</p>` : ''}

    </div>
  `;

  document.getElementById('recipe-modal').showModal();
}

function closeModal() {
  document.getElementById('recipe-modal').close();
}

// ── Event listeners ───────────────────────────────────
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('recipe-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

function syncFilterActive(id) {
  document.getElementById(id).classList.toggle('active', document.getElementById(id).value !== '');
}

['search', 'cuisine', 'time', 'category'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    syncFilterActive(id);
    renderGrid(getFiltered());
  });
});

document.getElementById('clear-filters').addEventListener('click', () => {
  ['search', 'cuisine', 'time', 'category'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('active');
  });
  renderGrid(allRecipes);
});

// ── Init ──────────────────────────────────────────────
loadRecipes();

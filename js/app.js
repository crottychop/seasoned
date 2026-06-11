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
        <div class="recipe-card-meta">
          <span class="tag cuisine">${recipe.cuisine}</span>
          <span class="tag">${recipe.category}</span>
          <span class="tag time">${formatTime(recipe.totalMinutes)}</span>
        </div>
        <h2 class="recipe-card-title">${recipe.title}</h2>
        <p class="recipe-card-desc">${recipe.description}</p>
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

  const hasRecipe = recipe.ingredients && recipe.ingredients.length > 0;
  document.getElementById('modal-content').innerHTML = `
    ${recipe.photo ? `<img src="${recipe.photo}" alt="${recipe.title}" class="modal-hero" />` : ''}
    <h2>${recipe.title}</h2>
    <div class="modal-meta">
      <span class="tag cuisine">${recipe.cuisine}</span>
      <span class="tag">${recipe.category}</span>
      <span class="tag time">${formatTime(recipe.totalMinutes)}</span>
    </div>
    <p style="margin-bottom:1.5rem; color: var(--mid); font-family: system-ui, sans-serif;">
      ${recipe.description}
    </p>
    ${hasRecipe ? `
    <div class="modal-section">
      <h3>Ingredients</h3>
      <ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
    </div>
    <div class="modal-section">
      <h3>Instructions</h3>
      <ol>${recipe.instructions.map(s => `<li>${s}</li>`).join('')}</ol>
    </div>` : `
    <div class="modal-note">
      Recipe coming soon — add yours to data/recipes.json
    </div>`}
    ${recipe.notes && recipe.notes !== 'Recipe to be filled in.' ? `
    <div class="modal-section" style="margin-top:1.5rem">
      <h3>Notes</h3>
      <div class="modal-note">${recipe.notes}</div>
    </div>` : ''}
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

['search', 'cuisine', 'time', 'category'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => renderGrid(getFiltered()));
});

document.getElementById('clear-filters').addEventListener('click', () => {
  document.getElementById('search').value = '';
  document.getElementById('cuisine').value = '';
  document.getElementById('time').value = '';
  document.getElementById('category').value = '';
  renderGrid(allRecipes);
});

// ── Init ──────────────────────────────────────────────
loadRecipes();

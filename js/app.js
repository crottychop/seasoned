let allRecipes = [];
let recById = {};
let slugById = {};
let idBySlug = {};
let modalOpen = false;
let currentRecipeId = null;
let currentView = 'home';

const VIEWS = ['home', 'recipes', 'reminisce'];
const FILTER_IDS = ['search', 'cuisine', 'time', 'category'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const noHover = window.matchMedia('(hover: none)');

function withTransition(fn) {
  if (typeof document.startViewTransition === 'function' && !reduceMotion.matches) {
    return document.startViewTransition(fn);
  }
  fn();
  return { finished: Promise.resolve(), ready: Promise.resolve() };
}
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── Load ───────────────────────────────────────────────
async function loadRecipes() {
  const res = await fetch('data/recipes.json', { cache: 'no-cache' });
  allRecipes = await res.json();
  allRecipes.forEach(r => {
    recById[r.id] = r;
    let s = slugify(r.title);
    if (idBySlug[s] != null) s = `${s}-${r.id}`;
    slugById[r.id] = s; idBySlug[s] = r.id;
  });
  // recipes view (reused filterable grid)
  populateFilters();
  renderCategoryTabs();
  renderGrid(allRecipes);
  renderActiveChips();
  // home
  preloadPhotos();
  initHero();
  // routing
  initRoute();
}

// ══ HOME: "Kain Tayo" card with a cursor image-trail ════
// Bias the deck to the time of day, then the rest, shuffled.
function timeOfDay() {
  const h = new Date().getHours();
  if (h < 5)  return { cat: 'Dessert' };
  if (h < 11) return { cat: 'Breakfast' };
  if (h < 15) return { cat: 'Soup' };
  return { cat: 'Dinner' };
}
function buildDeck() {
  const cat = timeOfDay().cat;
  const inCat = shuffle(allRecipes.filter(r => r.category === cat)).map(r => r.id);
  const rest  = shuffle(allRecipes.filter(r => r.category !== cat)).map(r => r.id);
  return [...inCat, ...rest];
}

const imgCache = {};
function preloadPhotos() {
  allRecipes.forEach(r => { if (r.photo) { const im = new Image(); im.src = r.photo; imgCache[r.id] = im; } });
}

// HOME = two layers over a full-bleed plum hero:
//  • faint slideshow — photos cycling right-to-left at ~20% opacity, always
//    (this is the idle state).
//  • bright trail — big rounded photo tiles spawned along the cursor's path
//    (Square-style), full opacity, fading oldest-first — only while moving.
let deck = [];
let slidePos = 0;
let sliding = false;
let trailIndex = 0;
const IDLE_MS = 4500;     // gentle faint-photo crossfade interval
const TRAIL_MAX = 9;      // max live trail tiles
const randGap = () => 70 + Math.random() * 170;   // organic spacing: 70–240px

function makeSlide(id) {
  const img = document.createElement('img');
  img.className = 'slide'; img.alt = '';
  img.src = (imgCache[id] && imgCache[id].src) || recById[id].photo;
  return img;
}
function advanceSlide() {
  if (sliding) return;
  const show = document.getElementById('slideshow');
  if (!show) return;
  const prev = show.lastElementChild;
  slidePos = (slidePos + 1) % deck.length;
  const next = makeSlide(deck[slidePos]);
  next.classList.add('fade');             // start transparent
  show.appendChild(next);
  void next.offsetWidth;                  // reflow so the transition runs
  sliding = true;
  next.classList.remove('fade');          // → fade in
  if (prev) prev.classList.add('fade');   // → fade out
  setTimeout(() => { if (prev && prev.parentNode) prev.remove(); sliding = false; }, 1600);
}
function spawnTrail(layer, x, y) {
  const id = deck[trailIndex % deck.length];
  trailIndex++;
  const img = document.createElement('img');
  img.className = 'trail-img'; img.alt = '';
  img.src = (imgCache[id] && imgCache[id].src) || recById[id].photo;
  img.style.left = x + 'px';
  img.style.top = y + 'px';
  img.style.setProperty('--rot', (Math.random() * 10 - 5).toFixed(1) + 'deg');
  layer.appendChild(img);
  while (layer.children.length > TRAIL_MAX) layer.removeChild(layer.firstChild);
  img.addEventListener('animationend', () => img.remove());
}
function initHero() {
  deck = buildDeck();
  const hero = document.getElementById('hero');
  const show = document.getElementById('slideshow');
  const layer = document.getElementById('trail-layer');
  if (!hero || !show || !layer) return;
  show.appendChild(makeSlide(deck[0]));        // faint background, first photo
  if (reduceMotion.matches) return;            // static, no motion
  setInterval(advanceSlide, IDLE_MS);          // faint cycling, always
  // bright cursor trail with organic (randomized) spacing.
  // While moving, the hero gets .moving (idle photos fade to black).
  let lx = null, ly = null, acc = 0, nextGap = randGap(), idleTO = null;
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    hero.classList.add('moving');
    clearTimeout(idleTO);
    idleTO = setTimeout(() => hero.classList.remove('moving'), 450);
    if (lx != null) acc += Math.hypot(x - lx, y - ly);
    lx = x; ly = y;
    if (acc < nextGap) return;
    acc = 0; nextGap = randGap();
    spawnTrail(layer, x + (Math.random() * 2 - 1) * 24, y + (Math.random() * 2 - 1) * 24);
  });
}

// ══ ROUTER ═══════════════════════════════════════════════
function showView(name) {
  if (!VIEWS.includes(name)) name = 'home';
  currentView = name;
  document.body.dataset.view = name;   // home hides the top bar (Mmm/Ahh cover nav)
  VIEWS.forEach(v => { const el = document.getElementById('view-' + v); if (el) el.hidden = v !== name; });
  document.querySelectorAll('.topbar-link[data-view]').forEach(l => l.classList.toggle('is-current', l.dataset.view === name));
  window.scrollTo(0, 0);
}
function goView(name) {
  const url = name === 'home' ? '#/' : '#/' + name;
  history.pushState({ view: name }, '', url);
  showView(name);
}
function initRoute() {
  const h = location.hash;
  const rec = h.match(/^#\/recipe\/(.+)$/);
  if (rec && idBySlug[rec[1]] != null) {
    showView('home');
    history.replaceState({ view: 'home' }, '', '#/');
    navigateToRecipe(idBySlug[rec[1]], null);
  } else if (h === '#/recipes') { history.replaceState({ view: 'recipes' }, '', h); showView('recipes'); }
  else if (h === '#/reminisce') { history.replaceState({ view: 'reminisce' }, '', h); showView('reminisce'); }
  else { history.replaceState({ view: 'home' }, '', '#/'); showView('home'); }
}
document.querySelectorAll('[data-view]').forEach(b =>
  b.addEventListener('click', e => { e.preventDefault(); goView(b.dataset.view); }));

window.addEventListener('popstate', e => {
  const st = e.state || {};
  if (st.recipe != null) { showRecipe(st.recipe, null); }
  else { hideRecipe(); showView(st.view || 'home'); }
});

// ══ RECIPE OVERLAY (history-routed + morph) ═════════════
function navigateToRecipe(id, sourceImg) {
  const url = `#/recipe/${slugById[id]}`;
  const st = { recipe: id, view: currentView };
  if (modalOpen) history.replaceState(st, '', url);
  else history.pushState(st, '', url);
  showRecipe(id, sourceImg);
}
function showRecipe(id, sourceImg) {
  const recipe = recById[id];
  if (!recipe) return;
  const modal = document.getElementById('recipe-modal');
  if (sourceImg) sourceImg.style.viewTransitionName = 'recipe-hero';
  const run = async () => {
    if (sourceImg) sourceImg.style.viewTransitionName = '';
    renderModal(recipe);
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
    // Decode the hero photo before the view-transition snapshots the new
    // state, so the morph animates the actual image — not an empty container.
    const hero = modal.querySelector('.recipe-gallery img');
    if (hero) { try { await hero.decode(); } catch (e) { /* cache/abort — ignore */ } }
  };
  modalOpen = true; currentRecipeId = id;
  withTransition(run);
}
function hideRecipe() {
  const modal = document.getElementById('recipe-modal');
  if (!modal.open) { modalOpen = false; currentRecipeId = null; return; }
  const id = currentRecipeId;
  let target = null;
  const run = () => {
    modal.close();
    target = document.querySelector(`#recipe-grid .recipe-card[data-id="${id}"] .recipe-card-img`);
    if (target) target.style.viewTransitionName = 'recipe-hero';
  };
  const t = withTransition(run);
  t.finished.finally(() => { if (target) target.style.viewTransitionName = ''; });
  modalOpen = false; currentRecipeId = null;
}
function renderModal(recipe) {
  const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;
  const hasInstructions = recipe.instructions && recipe.instructions.length > 0;
  const hasNotes = recipe.notes && !recipe.notes.startsWith('Recipe to be filled in');
  const cards = recipe.ingredientCards && recipe.ingredientCards.length ? recipe.ingredientCards : null;
  document.getElementById('modal-content').innerHTML = `
    <div class="recipe-view">
      <div class="recipe-view-header">
        <p class="recipe-view-category">${recipe.cuisine} &middot; ${recipe.category}</p>
        <h2 class="recipe-view-title">${recipe.title}</h2>
        <p class="recipe-view-desc">${recipe.description}</p>
        <div class="recipe-view-pills">
          <span class="recipe-pill">${formatTime(recipe.totalMinutes)}</span>
          ${recipe.serves ? `<span class="recipe-pill">Serves ${recipe.serves}</span>` : ''}
        </div>
      </div>
      ${recipe.photo ? `<div class="recipe-gallery"><img style="view-transition-name:recipe-hero" src="${recipe.photo}" alt="${recipe.title}" /></div>` : ''}
      <div class="recipe-view-body">
        <div>
          <div class="recipe-col-head">
            <h3>Ingredients</h3>
            ${cards ? `<button class="ing-toggle" id="ing-toggle">View as list</button>` : ''}
          </div>
          ${cards
            ? `<div class="ingredient-grid" id="ing-grid">${cards.map(c => `
                <figure class="ing-card">
                  <span class="ing-thumb${c.img ? '' : ' is-empty'}">${c.img ? `<img src="${c.img}" alt="${c.label}" loading="lazy" />` : ''}</span>
                  <figcaption>${c.label}</figcaption>
                </figure>`).join('')}</div>
               <ul class="ingredient-list" id="ing-list" hidden>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>`
            : hasIngredients
              ? `<ul class="ingredient-list">${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>`
              : `<p class="recipe-col-empty">Ingredients coming soon.</p>`}
        </div>
        <div>
          <div class="recipe-col-head"><h3>Method</h3></div>
          ${hasInstructions
            ? `<ol class="method-steps">${recipe.instructions.map((s, i) =>
                `<li><span class="step-num">${i + 1}</span><p class="step-text">${s}</p></li>`).join('')}</ol>`
            : `<p class="recipe-col-empty">Method coming soon.</p>`}
        </div>
      </div>
      ${hasNotes ? `<p class="recipe-view-notes">${recipe.notes}</p>` : ''}
    </div>`;
  const tog = document.getElementById('ing-toggle');
  if (tog) tog.addEventListener('click', () => {
    const grid = document.getElementById('ing-grid');
    const list = document.getElementById('ing-list');
    const toList = !grid.hidden;          // grid currently shown → switch to list
    grid.hidden = toList; list.hidden = !toList;
    tog.textContent = toList ? 'View as grid' : 'View as list';
  });
}

const modalEl = document.getElementById('recipe-modal');
document.getElementById('modal-close').addEventListener('click', () => history.back());
document.getElementById('modal-back').addEventListener('click', () => history.back());
modalEl.addEventListener('click', e => { if (e.target === modalEl) history.back(); });
modalEl.addEventListener('cancel', e => { e.preventDefault(); history.back(); });

// ══ FILTERS + GRID (recipes view) ═══════════════════════
function cardHTML(recipe) {
  return `
    <button class="recipe-card${recipe.complete ? '' : ' recipe-card--wip'}" data-id="${recipe.id}" aria-label="Open ${recipe.title}">
      ${recipe.photo
        ? `<img class="recipe-card-img" src="${recipe.photo}" alt="${recipe.title}" loading="lazy" />`
        : `<span class="recipe-card-img"></span>`}
      ${recipe.complete ? '' : `<span class="recipe-card-flag">In progress</span>`}
      <span class="recipe-card-body">
        <span class="recipe-card-title">${recipe.title}</span>
        <span class="recipe-card-tags">${recipe.cuisine}, ${recipe.category} &middot; ${formatTime(recipe.totalMinutes)}</span>
      </span>
    </button>`;
}
function setGridCardNames(on) {
  document.querySelectorAll('#recipe-grid .recipe-card').forEach(card => {
    card.style.viewTransitionName = on ? `gcard-${card.dataset.id}` : '';
  });
}
function wireCards(container) {
  container.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', () => navigateToRecipe(parseInt(card.dataset.id), card.querySelector('.recipe-card-img')));
  });
}
function populateFilters() {
  fillSelect('cuisine', [...new Set(allRecipes.map(r => r.cuisine))].sort());
  fillSelect('category', [...new Set(allRecipes.map(r => r.category))].sort());
}
function fillSelect(id, values) {
  const sel = document.getElementById(id);
  values.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
}
function renderCategoryTabs() {
  const order = ['Breakfast', 'Soup', 'Dinner', 'Side', 'Dessert'];
  const cats = [...new Set(allRecipes.map(r => r.category))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const el = document.getElementById('category-tabs');
  el.innerHTML = ['', ...cats].map(c =>
    `<button class="cat-tab${c === '' ? ' is-active' : ''}" role="tab" aria-selected="${c === ''}" data-cat="${c}">${c === '' ? 'All' : c}</button>`).join('');
  el.querySelectorAll('.cat-tab').forEach(tab => tab.addEventListener('click', () => {
    document.getElementById('category').value = tab.dataset.cat;
    syncFilterActive('category'); applyFilters();
  }));
}
function updateCategoryTabUI() {
  const cur = document.getElementById('category').value;
  document.querySelectorAll('.cat-tab').forEach(t => { const on = t.dataset.cat === cur; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on); });
}
const TIME_LABELS = { '30': 'Under 30 min', '60': 'Under 1 hr', '120': 'Under 2 hrs' };
function renderActiveChips() {
  const wrap = document.getElementById('active-chips');
  const v = id => document.getElementById(id).value;
  const parts = [];
  if (v('category')) parts.push(['category', v('category')]);
  if (v('cuisine')) parts.push(['cuisine', v('cuisine')]);
  if (v('time')) parts.push(['time', TIME_LABELS[v('time')] || v('time')]);
  if (v('search').trim()) parts.push(['search', `“${v('search').trim()}”`]);
  let html = parts.map(([f, label]) => `<button class="chip chip-active" data-clear="${f}">${label} <span class="chip-x" aria-hidden="true">✕</span></button>`).join('');
  if (parts.length >= 2) html += `<button class="chip chip-clear" data-clear="all">Clear all</button>`;
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-clear]').forEach(c => c.addEventListener('click', () => clearFilter(c.dataset.clear)));
}
function clearFilter(which) {
  (which === 'all' ? FILTER_IDS : [which]).forEach(id => { const el = document.getElementById(id); el.value = ''; el.classList.remove('active'); });
  applyFilters();
}
function getFiltered() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  const cuisine = document.getElementById('cuisine').value;
  const maxTime = parseInt(document.getElementById('time').value) || Infinity;
  const category = document.getElementById('category').value;
  return allRecipes.filter(r => {
    const mq = !query || r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query) || r.ingredients.some(i => i.toLowerCase().includes(query));
    return mq && (!cuisine || r.cuisine === cuisine) && (r.totalMinutes <= maxTime) && (!category || r.category === category);
  });
}
function applyFilters() {
  setGridCardNames(true);
  const t = withTransition(() => { renderGrid(getFiltered()); renderActiveChips(); updateCategoryTabUI(); setGridCardNames(true); });
  t.finished.finally(() => setGridCardNames(false));
}
function renderGrid(recipes) {
  const grid = document.getElementById('recipe-grid');
  const count = document.getElementById('result-count');
  count.textContent = recipes.length === allRecipes.length ? `${recipes.length} recipes` : `${recipes.length} of ${allRecipes.length}`;
  if (recipes.length === 0) { grid.innerHTML = `<div class="empty-state"><p>No recipes match your filters.</p></div>`; return; }
  // Completed recipes lead; in-progress follow. Headings only appear when both groups exist.
  const done = recipes.filter(r => r.complete);
  const wip = recipes.filter(r => !r.complete);
  const section = (label, items) =>
    (done.length && wip.length ? `<h3 class="grid-section-head">${label} <span class="grid-section-count">${items.length}</span></h3>` : '')
    + items.map(cardHTML).join('');
  grid.innerHTML = section('Completed', done) + section('In progress', wip);
  wireCards(grid);
}
function formatTime(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function syncFilterActive(id) { const el = document.getElementById(id); el.classList.toggle('active', el.value !== ''); }
FILTER_IDS.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => { syncFilterActive(id); applyFilters(); });
});

// Dismiss the Father's Day note
document.getElementById('dispatch-note-close')?.addEventListener('click', () => {
  const n = document.getElementById('dispatch-note'); if (n) n.hidden = true;
});

// ── Init ───────────────────────────────────────────────
loadRecipes();

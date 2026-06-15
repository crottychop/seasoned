let allRecipes = [];
let recById = {};
let slugById = {};
let idBySlug = {};
let modalOpen = false;
let currentRecipeId = null;
let currentView = 'home';
let pantryData = null;
let pantryView = 'grid';

const VIEWS = ['home', 'recipes', 'pantry'];
const FILTER_IDS = ['search', 'cuisine', 'time', 'category'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const noHover = window.matchMedia('(hover: none)');

// ══ PANTRY store — shared inventory ═════════════════════
// State holds only the OUT-of-stock slugs (everything defaults to in-stock, so an
// empty store means "we have everything"). localStorage by default; defining
// window.SEASONED_FIREBASE upgrades it to a live family-shared store, no other
// code changes.
const Pantry = (() => {
  const KEY = 'seasoned-pantry-out';
  const listeners = new Set();
  let out = {};                 // slug -> true means OUT of stock
  let pushCloud = null;         // set once Firebase connects
  try { out = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}

  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) {} });
  const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(out)); } catch (e) {} };

  const isInStock = slug => !out[slug];
  function setStock(slug, inStock) {
    if (inStock) delete out[slug]; else out[slug] = true;
    saveLocal();
    if (pushCloud) pushCloud(slug, inStock);
    emit();
  }
  const toggle = slug => setStock(slug, !isInStock(slug));
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const synced = () => !!pushCloud;

  async function connectCloud(cfg) {
    const a = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const d = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
    const au = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const app = a.initializeApp(cfg);
    // Rules require a signed-in user. Anonymous auth issues a silent token on
    // first load — no login screen, invisible to the family. We must await it
    // before any read/write, or the rules will reject us.
    await au.signInAnonymously(au.getAuth(app));
    const database = d.getDatabase(app);
    d.onValue(d.ref(database, 'pantryOut'), snap => { out = snap.val() || {}; saveLocal(); emit(); });
    pushCloud = (slug, inStock) => d.set(d.ref(database, 'pantryOut/' + slug), inStock ? null : true);
    emit();
  }
  if (window.SEASONED_FIREBASE) connectCloud(window.SEASONED_FIREBASE).catch(e => console.warn('[pantry] cloud sync off:', e.message));

  return { isInStock, setStock, toggle, subscribe, synced };
})();

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
  // pantry master list (Fridge / Freezer / Pantry → groups → items)
  try { pantryData = await (await fetch('data/pantry.json', { cache: 'no-cache' })).json(); } catch (e) { pantryData = []; }
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
  // pantry: refresh the view or live-update recipe markers whenever stock changes
  Pantry.subscribe(() => {
    if (currentView === 'pantry') renderPantry();
    if (modalOpen) updateStockMarkers();
  });
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

// HOME hero: a headline beside a single floating, borderless video card that
// crossfades through candid family-cooking clips — curated for people + food +
// cooking action, clean/ungraded footage (see process_media.sh).
const HERO_CLIPS = [
  'IMG_0789',  // najeer smiling at the counter
  'IMG_0381',  // breading katsu
  'IMG_2254',  // tossing pesto pasta
  'IMG_0794',  // serving the wagyu
  'IMG_2451',  // grilling skewers outside
  'IMG_4627',  // slicing the beef
].map(n => ({ src: `pictures/hero/${n}.mp4`, poster: `pictures/hero/${n}.jpg` }));

let bgDeck = [];
let bgPos = 0;
let sliding = false;
const IDLE_MS = 7000;     // each clip plays ~7s before crossfading to the next

function makeBgSlide(clip) {
  const v = document.createElement('video');
  v.className = 'slide';
  v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  v.preload = 'auto';
  v.poster = clip.poster;
  v.src = clip.src;
  v.play?.().catch(() => {});   // muted autoplay; ignore the rare reject
  return v;
}
function advanceSlide() {
  if (sliding || bgDeck.length < 2) return;
  const show = document.getElementById('slideshow');
  if (!show) return;
  const prev = show.lastElementChild;
  bgPos = (bgPos + 1) % bgDeck.length;
  const next = makeBgSlide(bgDeck[bgPos]);
  next.classList.add('fade');             // start transparent
  show.appendChild(next);
  void next.offsetWidth;                  // reflow so the transition runs
  sliding = true;
  next.classList.remove('fade');          // → fade in
  if (prev) prev.classList.add('fade');   // → fade out
  setTimeout(() => { if (prev && prev.parentNode) prev.remove(); sliding = false; }, 1600);
}
function initHero() {
  bgDeck = shuffle(HERO_CLIPS.slice());
  const show = document.getElementById('slideshow');
  if (!show) return;
  if (reduceMotion.matches) {                  // static poster, no motion
    const img = document.createElement('img');
    img.className = 'slide'; img.alt = ''; img.src = bgDeck[0].poster;
    show.appendChild(img);
    return;
  }
  show.appendChild(makeBgSlide(bgDeck[0]));     // first clip
  setInterval(advanceSlide, IDLE_MS);           // crossfade through the clips
}

// ══ ROUTER ═══════════════════════════════════════════════
function showView(name) {
  if (!VIEWS.includes(name)) name = 'home';
  currentView = name;
  document.body.dataset.view = name;   // home hides the top bar (Mmm/Ahh cover nav)
  VIEWS.forEach(v => { const el = document.getElementById('view-' + v); if (el) el.hidden = v !== name; });
  document.querySelectorAll('.topbar-link[data-view]').forEach(l => l.classList.toggle('is-current', l.dataset.view === name));
  if (name === 'pantry') renderPantry();
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
  else if (h === '#/pantry') { history.replaceState({ view: 'pantry' }, '', h); showView('pantry'); }
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
    const hero = modal.querySelector('.recipe-gallery img, .recipe-media img');
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
  const media = recipe.media && recipe.media.length ? recipe.media : null;
  const equipment = recipe.equipment && recipe.equipment.length ? recipe.equipment : null;
  const more = moreToCook(recipe);
  const stock = pantryData ? recipeStock(recipe) : null;
  const stockLine = stock && stock.relevant > 0
    ? (stock.missing.length === 0 ? "You've got everything for this ✓" : `You're missing ${stock.missing.map(titleize).join(', ')}`)
    : '';
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
      ${media
        ? `<div class="recipe-media">${media.map((m, i) => m.type === 'video'
            ? `<video class="rm-item" autoplay muted loop playsinline preload="metadata"${m.poster ? ` poster="${m.poster}"` : ''} src="${m.src}"></video>`
            : `<img class="rm-item"${i === 0 ? ' style="view-transition-name:recipe-hero"' : ''} src="${m.src}" alt="${recipe.title}" />`).join('')}</div>`
        : recipe.photo
          ? `<div class="recipe-gallery"><img style="view-transition-name:recipe-hero" src="${recipe.photo}" alt="${recipe.title}" /></div>`
          : ''}
      <div class="recipe-view-body">
        <div>
          <div class="recipe-col-head">
            <h3>Ingredients</h3>
            ${cards ? `<button class="ing-toggle" id="ing-toggle">View as list</button>` : ''}
          </div>
          ${stockLine ? `<p class="ing-stock-line${stock.missing.length ? ' is-missing' : ''}">${stockLine}</p>` : ''}
          ${cards
            ? `<div class="ingredient-grid" id="ing-grid">${cards.map(c => { const s = slugFromImg(c.img); return `
                <figure class="ing-card${s && !Pantry.isInStock(s) ? ' is-out' : ''}"${s ? ` data-slug="${s}"` : ''}>
                  <span class="ing-thumb${c.img ? '' : ' is-empty'}">${c.img ? `<img src="${c.img}" alt="${c.label}" loading="lazy" />` : ''}</span>
                  <figcaption>${c.label}</figcaption>
                </figure>`; }).join('')}</div>
               <ul class="ingredient-list" id="ing-list" hidden>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>`
            : hasIngredients
              ? `<ul class="ingredient-list">${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>`
              : `<p class="recipe-col-empty">Ingredients coming soon.</p>`}
          ${equipment ? `
          <div class="recipe-equip">
            <div class="recipe-col-head"><h3>Equipment</h3></div>
            ${equipment.some(e => e.img) ? `<div class="ingredient-grid equip-grid">${equipment.filter(e => e.img).map(e => `
                <figure class="ing-card">
                  <span class="ing-thumb"><img src="${e.img}" alt="${e.label}" loading="lazy" /></span>
                  <figcaption>${e.label}</figcaption>
                </figure>`).join('')}</div>` : ''}
            ${equipment.some(e => !e.img) ? `<p class="equip-plus">Plus ${equipment.filter(e => !e.img).map(e => e.label.toLowerCase()).join(' · ')}</p>` : ''}
          </div>` : ''}
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
      ${more.length ? `
      <section class="recipe-more">
        <div class="recipe-more-head"><h3>More to cook</h3></div>
        <div class="card-row at-start" id="more-row">${more.map(cardHTML).join('')}</div>
      </section>` : ''}
    </div>`;
  const tog = document.getElementById('ing-toggle');
  if (tog) tog.addEventListener('click', () => {
    const grid = document.getElementById('ing-grid');
    const list = document.getElementById('ing-list');
    const toList = !grid.hidden;          // grid currently shown → switch to list
    grid.hidden = toList; list.hidden = !toList;
    tog.textContent = toList ? 'View as grid' : 'View as list';
  });
  const moreRow = document.getElementById('more-row');
  if (moreRow) { wireCards(moreRow); wireRowFade(moreRow); }
}
// Other recipes to surface after this one: same cuisine first, then a shuffled rest.
function moreToCook(recipe) {
  const rest = allRecipes.filter(r => r.id !== recipe.id);
  const same = rest.filter(r => r.cuisine === recipe.cuisine);
  const others = shuffle(rest.filter(r => r.cuisine !== recipe.cuisine));
  return [...same, ...others].slice(0, 10);
}
// Toggle the edge-fade mask on a horizontal card-row as it scrolls.
function wireRowFade(row) {
  const update = () => {
    const max = row.scrollWidth - row.clientWidth;
    row.classList.toggle('at-start', row.scrollLeft <= 1);
    row.classList.toggle('at-end', row.scrollLeft >= max - 1);
  };
  row.addEventListener('scroll', update, { passive: true });
  update();
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

// ══ PANTRY view ═════════════════════════════════════════
function slugFromImg(img) { return img ? img.split('/').pop().replace(/\.\w+$/, '') : null; }
function titleize(slug) { const s = slug.replace(/-/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
// Inventory comes from the master pantry list (data/pantry.json).
const PANTRY_LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Equipment'];
function pantryItemHTML(i) {
  const inStock = Pantry.isInStock(i.slug);
  const cls = inStock ? 'is-in' : 'is-out';
  if (pantryView === 'list') {
    return `<button class="pantry-row ${cls}" data-slug="${i.slug}" aria-pressed="${!inStock}">
        <span class="pantry-dot"></span><span class="pantry-row-name">${i.name}</span>
        <span class="pantry-row-state">${inStock ? 'In stock' : 'Out'}</span></button>`;
  }
  return `<button class="pantry-item ${cls}" data-slug="${i.slug}" aria-pressed="${!inStock}">
      <span class="pantry-thumb${i.img ? '' : ' is-empty'}">${i.img ? `<img src="${i.img}" alt="${i.name}" loading="lazy" />` : ''}</span>
      <span class="pantry-label">${i.name}</span>
      <span class="pantry-state">${inStock ? 'In stock' : 'Out'}</span></button>`;
}
function renderPantry() {
  renderCookShelf();
  const host = document.getElementById('pantry-grid');
  if (!host || !pantryData) return;
  const inCount = pantryData.filter(i => Pantry.isInStock(i.slug)).length;
  const count = document.getElementById('pantry-count');
  if (count) count.textContent = `${inCount}/${pantryData.length} in stock · ${Pantry.synced() ? 'synced' : 'this device'}`;
  host.className = 'pantry-body ' + (pantryView === 'list' ? 'is-list' : 'is-grid');
  host.innerHTML = PANTRY_LOCATIONS.map(loc => {
    const locItems = pantryData.filter(i => i.location === loc);
    if (!locItems.length) return '';
    const groups = [...new Set(locItems.map(i => i.group))];
    const n = locItems.filter(i => Pantry.isInStock(i.slug)).length;
    return `<section class="pantry-loc">
        <div class="pantry-loc-head"><h3>${loc}</h3><span class="pantry-loc-count">${n}/${locItems.length} in stock</span></div>
        <div class="pantry-groups">${groups.map(g => `<div class="pantry-group">
          <h4 class="pantry-group-head">${g}</h4>
          <div class="pantry-items">${locItems.filter(i => i.group === g).map(pantryItemHTML).join('')}</div>
        </div>`).join('')}</div>
      </section>`;
  }).join('');
  host.querySelectorAll('[data-slug]').forEach(b => b.addEventListener('click', () => Pantry.toggle(b.dataset.slug)));
}

// ── "What can we make?" — recipes cookable from the current pantry ──
// Staples (salt, oil…) never block; ingredients not tracked in the pantry are
// assumed on hand. A recipe is "ready" when every relevant ingredient is in stock.
function recipeStock(recipe) {
  const tracked = {};
  (pantryData || []).forEach(i => { tracked[i.slug] = i; });
  const relevant = (recipe.ingredientCards || [])
    .map(c => slugFromImg(c.img))
    .filter(s => tracked[s] && !tracked[s].staple);
  const missing = relevant.filter(s => !Pantry.isInStock(s));
  return { relevant: relevant.length, missing, ready: relevant.length > 0 && missing.length === 0 };
}
function joinNames(arr) {
  if (arr.length <= 1) return arr.join('');
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}
// A quiet one-liner — noticeable, never a hero.
function renderCookShelf() {
  const host = document.getElementById('cook-shelf');
  if (!host) return;
  if (!pantryData) { host.innerHTML = ''; return; }
  const all = allRecipes.filter(r => r.ingredientCards && r.ingredientCards.length).map(r => ({ r, s: recipeStock(r) }));
  const ready = all.filter(x => x.s.ready);
  const almost = all.filter(x => !x.s.ready && x.s.missing.length >= 1 && x.s.missing.length <= 2);
  const link = x => `<button class="cook-link" data-id="${x.r.id}">${x.r.title}</button>`;
  let html = '';
  if (ready.length) {
    const names = joinNames(ready.slice(0, 3).map(link));
    const extra = ready.length > 3 ? `, and ${ready.length - 3} more` : '';
    html = `With what you have, you can make ${names}${extra}.`;
  } else if (almost.length) {
    const x = almost[0];
    html = `One stop from ${link(x)} — just ${x.s.missing.map(titleize).join(' & ').toLowerCase()}.`;
  }
  host.innerHTML = html;
  host.querySelectorAll('.cook-link').forEach(b =>
    b.addEventListener('click', () => navigateToRecipe(parseInt(b.dataset.id), null)));
}
// Live-update the out-of-stock dots on an open recipe without a full re-render.
function updateStockMarkers() {
  document.querySelectorAll('#modal-content .ing-card[data-slug]').forEach(card => {
    card.classList.toggle('is-out', !Pantry.isInStock(card.dataset.slug));
  });
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

const pantryViewToggle = document.getElementById('pantry-view-toggle');
if (pantryViewToggle) pantryViewToggle.addEventListener('click', () => {
  pantryView = pantryView === 'grid' ? 'list' : 'grid';
  pantryViewToggle.textContent = pantryView === 'grid' ? 'View as list' : 'View as grid';
  renderPantry();
});

// Dismiss the Father's Day note
document.getElementById('dispatch-note-close')?.addEventListener('click', () => {
  const n = document.getElementById('dispatch-note'); if (n) n.hidden = true;
});

// ── Init ───────────────────────────────────────────────
loadRecipes();

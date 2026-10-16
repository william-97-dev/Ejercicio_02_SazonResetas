'use strict';

const $ = (selector) => document.querySelector(selector);
const api = window.recipesAPI;
const state = { meals: [], featured: false, currentPage: 1, pageSize: 12, requestId: 0, lastFilters: {} };
const ui = {
  form: $('#searchForm'), search: $('#searchInput'), category: $('#categorySelect'),
  area: $('#areaSelect'), grid: $('#recipesGrid'), count: $('#resultsCount'),
  title: $('#resultsTitle'), description: $('#resultsDescription'), status: $('#statusMessage'),
  pagination: $('#pagination'), prev: $('#prevPage'), next: $('#nextPage'),
  pageLabel: $('#pageLabel'), dialog: $('#recipeDialog'), dialogContent: $('#dialogContent')
};

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
const imageUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && (url.hostname === 'www.themealdb.com' || url.hostname === 'themealdb.com')) return url.href;
  } catch { /* la imagen opcional puede estar vacía */ }
  return '../assets/no-image.png';
};
const debounce = (fn, ms) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; };

function getFilters() {
  return { search: ui.search.value.trim(), category: ui.category.value, area: ui.area.value };
}

function showStatus(title, details = '', retry = false) {
  ui.status.hidden = false;
  ui.status.innerHTML = `<strong>${escapeHTML(title)}</strong>${escapeHTML(details)}${retry ? '<div><button type="button" id="retryButton">Volver a intentar</button></div>' : ''}`;
  if (retry) $('#retryButton').addEventListener('click', () => loadRecipes());
}

function showSkeletons() {
  ui.grid.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton"><div class="skeleton-image shimmer"></div><div class="skeleton-title shimmer"></div><div class="skeleton-line shimmer"></div></div>').join('');
}

function recipeCard(meal) {
  const badge = meal.category || (state.featured ? 'Selección del día' : 'Receta');
  const area = meal.area || 'Descubre su origen';
  return `<article class="recipe-card">
    <div class="recipe-thumb"><img src="${escapeHTML(imageUrl(meal.image))}" alt="Fotografía de ${escapeHTML(meal.name)}" loading="lazy"/><span class="recipe-category">${escapeHTML(badge)}</span></div>
    <div class="recipe-content"><h4 title="${escapeHTML(meal.name)}">${escapeHTML(meal.name)}</h4>
    <div class="recipe-meta">◉ <span>${escapeHTML(area)}</span></div>
    <div class="recipe-footer"><span class="recipe-type">🍽 Receta de cocina</span><button class="view-recipe" data-id="${escapeHTML(meal.id)}" type="button">Ver receta →</button></div>
    </div></article>`;
}

function render() {
  ui.grid.innerHTML = '';
  ui.status.hidden = true;
  const total = state.meals.length;
  ui.count.textContent = `${total} ${total === 1 ? 'receta' : 'recetas'}`;
  ui.title.textContent = state.featured ? 'Una selección para inspirarte' : 'Resultados de tu búsqueda';
  ui.description.textContent = state.featured
    ? 'Selección inicial por la letra B. Busca o filtra para consultar el catálogo.'
    : total ? 'Encontramos estas recetas según los criterios seleccionados.' : 'Prueba otra búsqueda o cambia los filtros.';

  if (total === 0) {
    ui.pagination.hidden = true;
    showStatus('No encontramos recetas con esos filtros', 'Intenta otra categoría, región o un nombre diferente.');
    return;
  }

  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  state.currentPage = Math.min(Math.max(1, state.currentPage), pages);
  const offset = (state.currentPage - 1) * state.pageSize;
  ui.grid.innerHTML = state.meals.slice(offset, offset + state.pageSize).map(recipeCard).join('');
  ui.grid.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => { if (!img.src.endsWith('/no-image.png')) img.src = '../assets/no-image.png'; }, { once: true });
  });
  ui.pagination.hidden = pages <= 1;
  ui.prev.disabled = state.currentPage === 1;
  ui.next.disabled = state.currentPage === pages;
  ui.pageLabel.textContent = `Página ${state.currentPage} de ${pages}`;
}

async function loadRecipes() {
  const requestId = ++state.requestId;
  const filters = getFilters();
  state.lastFilters = filters;
  ui.status.hidden = true;
  ui.pagination.hidden = true;
  ui.count.textContent = 'Consultando...';
  ui.description.textContent = 'Buscando recetas en TheMealDB...';
  showSkeletons();
  try {
    const result = await api.listRecipes(filters);
    if (requestId !== state.requestId) return; // Evita resultados desordenados por respuestas lentas.
    state.meals = Array.isArray(result.meals) ? result.meals : [];
    state.featured = !!result.featured;
    state.currentPage = 1;
    render();
  } catch (error) {
    if (requestId !== state.requestId) return;
    state.meals = [];
    ui.grid.innerHTML = '';
    ui.count.textContent = 'Sin conexión';
    ui.description.textContent = 'No fue posible completar la consulta.';
    showStatus('No se pudieron cargar las recetas', error?.message || 'Ocurrió un error inesperado.', true);
  }
}

async function loadOptions() {
  try {
    const options = await api.getOptions();
    if (Array.isArray(options.categories)) {
      for (const name of options.categories) ui.category.add(new Option(name, name));
    }
    if (Array.isArray(options.areas)) {
      for (const name of options.areas) ui.area.add(new Option(name, name));
    }
  } catch (error) {
    // Permitir una nueva carga de las opciones sin bloquear la búsqueda por nombre.
    const categoryOpt = new Option('Error al cargar — reintentar', '', true, true);
    categoryOpt.disabled = true;
    ui.category.add(categoryOpt);
    const areaOpt = new Option('Error al cargar — reintentar', '', true, true);
    areaOpt.disabled = true;
    ui.area.add(areaOpt);
    console.warn('No se pudieron cargar las opciones de filtros:', error);
  }
}

function closeModal() { if (ui.dialog.open) ui.dialog.close(); }

async function showRecipe(id = null, randomized = false) {
  if (!ui.dialog.open) ui.dialog.showModal();
  ui.dialogContent.innerHTML = '<div class="modal-loading">🍽 &nbsp; Preparando tu receta...</div>';
  try {
    const recipe = randomized ? await api.getRandom() : await api.getRecipe(String(id));
    if (!ui.dialog.open) return;
    const tags = [recipe.category, recipe.area, ...(recipe.tags || [])].filter(Boolean);
    const ingredients = (recipe.ingredients || []).map(({ ingredient, measure }) => `<li><b>✓</b> ${escapeHTML(ingredient)} ${measure ? `— ${escapeHTML(measure)}` : ''}</li>`).join('');
    const steps = recipe.instructions || 'La API no contiene instrucciones para esta receta.';
    const videoButton = recipe.youtube ? `<button type="button" id="watchVideo">▶ Ver preparación en YouTube</button>` : '';
    ui.dialogContent.innerHTML = `<article><button type="button" class="dialog-close" id="closeDialog" aria-label="Cerrar receta">×</button>
      <img class="detail-cover" src="${escapeHTML(imageUrl(recipe.image))}" alt="${escapeHTML(recipe.name)}" />
      <div class="detail-body"><div class="detail-eyebrow">${randomized ? '✦ Tu receta sorpresa' : '✦ Receta de TheMealDB'}</div>
      <h2>${escapeHTML(recipe.name)}</h2><div class="detail-tags">${tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join('')}</div>
      <div class="detail-columns"><section><h3>🥕 Ingredientes</h3><ul class="ingredient-list">${ingredients || '<li>No hay ingredientes disponibles.</li>'}</ul></section>
      <section><h3>👩‍🍳 Preparación</h3><div class="instructions">${escapeHTML(steps)}</div>${videoButton ? `<div class="detail-actions">${videoButton}</div>` : ''}</section></div></div></article>`;
    $('#closeDialog').addEventListener('click', closeModal);
    if (recipe.youtube && $('#watchVideo')) $('#watchVideo').addEventListener('click', () => api.openVideo(recipe.youtube));
    const cover = ui.dialogContent.querySelector('.detail-cover');
    cover.addEventListener('error', () => { cover.src = '../assets/no-image.png'; }, { once: true });
    ui.dialog.scrollTop = 0;
  } catch (error) {
    ui.dialogContent.innerHTML = `<div class="modal-error"><h3>No fue posible abrir la receta</h3><p>${escapeHTML(error.message)}</p><button type="button" id="modalCloseError">Cerrar</button></div>`;
    $('#modalCloseError').addEventListener('click', closeModal);
  }
}

if (!api) {
  ui.grid.innerHTML = '';
  showStatus('Abre esta aplicación con Electron', 'Esta interfaz utiliza un puente de seguridad de Electron. Ejecuta npm start desde la carpeta del proyecto.');
} else {
  ui.form.addEventListener('submit', (event) => { event.preventDefault(); loadRecipes(); });
  const debouncedSearch = debounce(loadRecipes, 500);
  ui.search.addEventListener('input', debouncedSearch);
  ui.category.addEventListener('change', loadRecipes);
  ui.area.addEventListener('change', loadRecipes);
  $('#clearButton').addEventListener('click', () => { ui.search.value = ''; ui.category.value = ''; ui.area.value = ''; loadRecipes(); });
  $('#navExplore').addEventListener('click', () => $('#exploreSection').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  for (const button of ['#navRandom', '#tipRandom', '#heroRandom']) $(button).addEventListener('click', () => showRecipe(null, true));
  ui.grid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-id]');
    if (button) showRecipe(button.dataset.id);
  });
  ui.prev.addEventListener('click', () => { state.currentPage--; render(); $('#exploreSection').scrollIntoView({ behavior: 'smooth' }); });
  ui.next.addEventListener('click', () => { state.currentPage++; render(); $('#exploreSection').scrollIntoView({ behavior: 'smooth' }); });
  ui.dialog.addEventListener('click', (event) => { if (event.target === ui.dialog) closeModal(); });
  loadOptions();
  loadRecipes();
}

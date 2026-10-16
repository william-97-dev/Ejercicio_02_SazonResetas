'use strict';

const BASE = 'https://www.themealdb.com/api/json/v1/1/';
const cache = new Map();
const CACHE_MAX = 120;
const cacheTTL = 5 * 60 * 1000;

function validatedString(value, max = 80) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function getJSON(endpoint, params = {}, fetcher = globalThis.fetch) {
  const url = new URL(endpoint, BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  try {
    const response = await fetcher(key, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(16000)
    });
    if (!response.ok) throw new Error(`La API respondió con HTTP ${response.status}.`);
    const data = await response.json();
    if (!data || typeof data !== 'object') throw new Error('Respuesta inesperada de la API.');
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { data, expires: Date.now() + cacheTTL });
    return data;
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('La API tardó demasiado. Revisa tu conexión e inténtalo de nuevo.');
    }
    if (error instanceof TypeError) throw new Error('No se pudo conectar con TheMealDB. Revisa tu conexión a Internet.');
    throw error;
  }
}

function toSummary(meal, overrides = {}) {
  if (!meal || !meal.idMeal || !meal.strMeal) return null;
  return {
    id: String(meal.idMeal),
    name: String(meal.strMeal),
    image: String(meal.strMealThumb || ''),
    category: meal.strCategory || overrides.category || '',
    area: meal.strArea || overrides.area || ''
  };
}

function sortSummaries(meals) {
  return meals.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}

async function getOptions() {
  const [categories, areas] = await Promise.all([
    getJSON('list.php', { c: 'list' }),
    getJSON('list.php', { a: 'list' })
  ]);
  return {
    categories: (categories.meals || []).map((entry) => entry.strCategory).filter(Boolean).sort(),
    areas: (areas.meals || []).map((entry) => entry.strArea).filter(Boolean).sort()
  };
}

async function listRecipes(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) filters = {};
  const search = validatedString(filters.search, 100);
  const category = validatedString(filters.category);
  const area = validatedString(filters.area);
  let meals = [];
  let featured = false;

  // Búsqueda global por nombre: filtramos categoría y región usando los campos
  // completos strCategory y strArea del resultado de search.php.
  if (search) {
    const response = await getJSON('search.php', { s: search });
    meals = (response.meals || []).filter((meal) =>
      (!category || meal.strCategory === category) && (!area || meal.strArea === area)
    );
  } else if (category && area) {
    // API gratuita no admite AND entre categoría y región en una sola petición.
    // Solución: se cruzan los identificadores devueltos por ambos endpoints.
    const [catResult, areaResult] = await Promise.all([
      getJSON('filter.php', { c: category }),
      getJSON('filter.php', { a: area })
    ]);
    const areaIds = new Set((areaResult.meals || []).map((meal) => String(meal.idMeal)));
    meals = (catResult.meals || []).filter((meal) => areaIds.has(String(meal.idMeal)));
  } else if (category) {
    meals = (await getJSON('filter.php', { c: category })).meals || [];
  } else if (area) {
    meals = (await getJSON('filter.php', { a: area })).meals || [];
  } else {
    // TheMealDB V1 gratuita no incluye un endpoint para enumerar TODO el catálogo.
    // Mostramos una selección inicial por letra, claramente identificada en pantalla.
    featured = true;
    meals = (await getJSON('search.php', { f: 'b' })).meals || [];
  }

  return {
    featured,
    total: meals.length,
    meals: sortSummaries(meals.map((meal) => toSummary(meal, { category, area })))
  };
}

function normalizeRecipe(meal) {
  if (!meal) return null;
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = String(meal[`strIngredient${i}`] || '').trim();
    const measure = String(meal[`strMeasure${i}`] || '').trim();
    if (ingredient) ingredients.push({ ingredient, measure });
  }
  return {
    ...toSummary(meal),
    instructions: String(meal.strInstructions || '').trim(),
    ingredients,
    tags: String(meal.strTags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    youtube: String(meal.strYoutube || ''),
    source: String(meal.strSource || '')
  };
}

async function getRecipe(id) {
  if (typeof id !== 'string' || !/^\d{1,12}$/.test(id)) throw new Error('Identificador de receta inválido.');
  const response = await getJSON('lookup.php', { i: id });
  const meal = response.meals?.[0];
  if (!meal) throw new Error('No se encontró esa receta.');
  return normalizeRecipe(meal);
}

async function getRandom() {
  // Sin caché: una receta realmente distinta en cada petición, según la API.
  const response = await fetch(`${BASE}random.php`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(16000)
  }).catch((error) => {
    if (error?.name === 'TimeoutError') throw new Error('La API tardó demasiado.');
    throw new Error('No fue posible consultar una receta aleatoria.');
  });
  if (!response.ok) throw new Error(`La API respondió con HTTP ${response.status}.`);
  const body = await response.json();
  const meal = body.meals?.[0];
  if (!meal) throw new Error('La API no devolvió una receta aleatoria.');
  return normalizeRecipe(meal);
}

module.exports = { getOptions, listRecipes, getRecipe, getRandom, normalizeRecipe, toSummary, getJSON };

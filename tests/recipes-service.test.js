'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const service = require('../src/main/recipes-service');

const meal = (id, name, category = 'Seafood', area = 'Italian') => ({ idMeal: id, strMeal: name, strMealThumb: `https://www.themealdb.com/images/${id}.jpg`, strCategory: category, strArea: area });
const data = {
  'search.php?s=unique': { meals: [meal('8001', 'Unique Soup', 'Starter', 'Italian'),meal('8002', 'Unique Pasta', 'Pasta', 'Canadian')] },
  'filter.php?c=Seafood': { meals: [meal('1001', 'Fish A'),meal('1002', 'Fish B')] },
  'filter.php?a=Italian': { meals: [meal('1002','Fish B'),meal('1003','Pasta C')] },
  'search.php?f=b': { meals: [meal('123', 'Bolognese'),meal('124', 'Bread')] },
  'lookup.php?i=123456': { meals: [{ ...meal('123456', 'Delicious Test'), strIngredient1: 'Salt', strMeasure1: '1 tsp', strIngredient2: 'Tomato', strMeasure2: '2', strInstructions: 'Cut and cook.', strTags: 'Fast,Family' }] },
  'list.php?c=list': { meals: [{ strCategory: 'Seafood' }, { strCategory: 'Pasta' }] },
  'list.php?a=list': { meals: [{ strArea: 'Italian' }, { strArea: 'Canadian' }] }
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const urlObj = new URL(url);
  const key = `${urlObj.pathname.split('/').pop()}?${urlObj.searchParams.toString()}`;
  if (!Object.hasOwn(data,key)) throw new Error(`Consulta no simulada: ${key}`);
  return { ok: true, json: async () => data[key] };
};

test('Devuelve opciones reales de categoría y región', async () => {
  const options = await service.getOptions();
  assert.deepEqual(options.categories, ['Pasta','Seafood']);
  assert.deepEqual(options.areas, ['Canadian','Italian']);
});
test('Busca globalmente por nombre y aplica filtros sobre campos completos', async () => {
  const output = await service.listRecipes({ search: 'unique', area: 'Italian' });
  assert.equal(output.total, 1);
  assert.equal(output.meals[0].id, '8001');
});
test('Combina categoría y región cruzando los identificadores', async () => {
  const output = await service.listRecipes({ category: 'Seafood', area: 'Italian' });
  assert.equal(output.total, 1);
  assert.equal(output.meals[0].id, '1002');
});
test('Filtro de una sola categoría', async () => {
  const output = await service.listRecipes({ category: 'Seafood' });
  assert.equal(output.total, 2);
});
test('Sin criterios obtiene selección inicial explícita', async () => {
  const output = await service.listRecipes({});
  assert.equal(output.featured, true);
  assert.equal(output.total, 2);
});
test('Detalle contiene ingredientes, medidas e instrucciones', async () => {
  const output = await service.getRecipe('123456');
  assert.deepEqual(output.ingredients, [{ ingredient:'Salt', measure:'1 tsp' },{ ingredient:'Tomato', measure:'2' }]);
  assert.equal(output.instructions, 'Cut and cook.');
  assert.deepEqual(output.tags, ['Fast','Family']);
});
test('Rechaza identificadores no numéricos (validación de entrada IPC)', async () => {
  await assert.rejects(() => service.getRecipe('../../etc/passwd'), /inválido/);
});
test.after(() => { globalThis.fetch = originalFetch; });

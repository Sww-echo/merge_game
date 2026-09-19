const requireString = (value, field, id) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Resource "${id}" requires a non-empty ${field}.`);
  }
};

export function validateResources(resources) {
  if (!resources || !Array.isArray(resources.fruits) || resources.fruits.length === 0) {
    throw new Error('resources.json must contain a non-empty fruits array.');
  }

  const requiredAssets = ['clickSound', 'popEffect', 'menuBackground', 'startButton'];
  if (!resources.assets || typeof resources.assets !== 'object') {
    throw new Error('resources.json must contain an assets object.');
  }
  requiredAssets.forEach((asset) => requireString(resources.assets[asset], `assets.${asset}`, asset));

  const ids = new Set();
  const fruitIds = new Set(resources.fruits.map((fruit) => fruit.id));

  resources.fruits.forEach((fruit, index) => {
    const id = fruit?.id || `item-${index}`;
    requireString(fruit?.id, 'id', id);

    const renderMode = fruit?.renderMode || 'texture';
    if (!['texture', 'color'].includes(renderMode)) {
      throw new Error(`Fruit "${id}" renderMode must be "texture" or "color".`);
    }
    if (renderMode === 'texture') requireString(fruit?.texture, 'texture', id);
    if (renderMode === 'color') requireString(fruit?.color, 'color', id);
    if (fruit?.text !== undefined && typeof fruit.text !== 'string') {
      throw new Error(`Fruit "${id}" text must be a string.`);
    }
    if (fruit?.textColor !== undefined) requireString(fruit.textColor, 'textColor', id);

    if (ids.has(fruit.id)) {
      throw new Error(`Duplicate fruit id: "${fruit.id}".`);
    }
    ids.add(fruit.id);

    if (!Number.isFinite(fruit.radius) || fruit.radius <= 0) {
      throw new Error(`Fruit "${id}" requires a positive radius.`);
    }
    if (!Number.isFinite(fruit.score) || fruit.score < 0) {
      throw new Error(`Fruit "${id}" requires a non-negative score.`);
    }
    if (fruit.mergeTo !== null && fruit.mergeTo !== undefined && !fruitIds.has(fruit.mergeTo)) {
      throw new Error(`Fruit "${id}" points to missing merge target "${fruit.mergeTo}".`);
    }
  });

  if (!resources.fruits.some((fruit) => fruit.spawnable !== false)) {
    throw new Error('At least one fruit must be spawnable.');
  }

  return resources;
}

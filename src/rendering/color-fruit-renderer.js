import { drawColorFruit } from '../resources/fruit-visual.js';

export function renderColorFruits(render, Matter) {
  const bodies = Matter.Composite.allBodies(render.engine.world);
  bodies.forEach((body) => {
    if (!body.fruitRender || body.render.visible !== false) return;
    drawColorFruit(render.context, body);
  });
}

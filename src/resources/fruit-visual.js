const DEFAULT_COLOR = '#d8c7ff';
const DEFAULT_TEXT_COLOR = '#202124';
const FONT_FAMILY = 'Azeret Mono, ui-monospace, SFMono-Regular, Menlo, monospace';

export function getFruitRenderMode(fruit) {
  return fruit?.renderMode === 'color' ? 'color' : 'texture';
}

export function isColorFruit(fruit) {
  return getFruitRenderMode(fruit) === 'color';
}

export function getFruitColor(fruit) {
  return fruit?.color || DEFAULT_COLOR;
}

export function getFruitTextColor(fruit) {
  return fruit?.textColor || DEFAULT_TEXT_COLOR;
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function getFruitPreviewUrl(fruit) {
  if (!isColorFruit(fruit)) return fruit.texture;

  const text = escapeXml(fruit.text || '');
  const color = escapeXml(getFruitColor(fruit));
  const textColor = escapeXml(getFruitTextColor(fruit));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r="58" fill="${color}" stroke="#202124" stroke-opacity=".18" stroke-width="4"/>
      <text x="64" y="71" fill="${textColor}" font-family="${FONT_FAMILY}" font-size="28" font-weight="700" text-anchor="middle">${text}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function fitTextSize(context, text, radius) {
  let size = Math.max(10, Math.min(34, radius * 0.46));
  const maxWidth = radius * 1.45;

  while (size > 10) {
    context.font = `700 ${size}px ${FONT_FAMILY}`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 1;
  }

  return size;
}

export function drawColorFruit(context, body) {
  const fruit = body.fruitRender;
  if (!body || !isColorFruit(fruit) || body.render.visible !== false) return;

  const radius = body.circleRadius || fruit.radius;
  const scaleX = body.visual?.scaleX || 1;
  const scaleY = body.visual?.scaleY || 1;
  const opacity = body.render.opacity ?? 1;

  context.save();
  context.globalAlpha = opacity;
  context.translate(body.position.x, body.position.y);
  context.rotate(body.angle || 0);
  context.scale(scaleX, scaleY);
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fillStyle = getFruitColor(fruit);
  context.fill();
  context.lineWidth = Math.max(1.5, radius * 0.06);
  context.strokeStyle = fruit.strokeColor || 'rgba(32, 33, 36, 0.18)';
  context.stroke();
  context.restore();

  const text = String(fruit.text ?? '');
  if (!text) return;

  context.save();
  context.globalAlpha = opacity;
  context.translate(body.position.x, body.position.y);
  context.scale(scaleX, scaleY);
  const fontSize = fitTextSize(context, text, radius);
  context.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  context.fillStyle = getFruitTextColor(fruit);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 0, 0);
  context.restore();
}

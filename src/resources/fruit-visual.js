const DEFAULT_COLOR = '#d8c7ff';
const DEFAULT_TEXT_COLOR = '#202124';
const FONT_FAMILY = 'Azeret Mono, ui-monospace, SFMono-Regular, Menlo, monospace';
const RAINBOW_STOPS = [
  ['0%', '#ff1744'],
  ['16%', '#ff8f00'],
  ['32%', '#ffe600'],
  ['48%', '#23e65b'],
  ['64%', '#00d9ff'],
  ['80%', '#2979ff'],
  ['92%', '#d500f9'],
  ['100%', '#ff1744'],
];

export function getFruitRenderMode(fruit) {
  return fruit?.renderMode === 'color' ? 'color' : 'texture';
}

export function isColorFruit(fruit) {
  return getFruitRenderMode(fruit) === 'color';
}

export function isRainbowFruit(fruit) {
  return isColorFruit(fruit) && fruit?.rainbow === true;
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
  const rainbowStops = RAINBOW_STOPS
    .map(([offset, stopColor]) => `<stop offset="${offset}" stop-color="${stopColor}"/>`)
    .join('');
  const fill = isRainbowFruit(fruit) ? 'url(#rainbow-fill)' : color;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <style>
        @keyframes rainbow-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rainbow-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
        .rainbow-fill { transform-box: fill-box; transform-origin: center; animation: rainbow-spin 4s linear infinite; }
        .rainbow-ball { transform-box: fill-box; transform-origin: center; animation: rainbow-breathe 1.8s ease-in-out infinite; }
      </style>
      <defs>
        <linearGradient id="rainbow-fill" x1="10" y1="12" x2="118" y2="116" gradientUnits="userSpaceOnUse">${rainbowStops}</linearGradient>
        <radialGradient id="rainbow-shine" cx="34%" cy="28%" r="70%">
          <stop offset="0" stop-color="#fff" stop-opacity=".58"/>
          <stop offset=".46" stop-color="#fff" stop-opacity=".08"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <g class="${isRainbowFruit(fruit) ? 'rainbow-ball' : ''}">
        <circle class="${isRainbowFruit(fruit) ? 'rainbow-fill' : ''}" cx="64" cy="64" r="58" fill="${fill}" stroke="#202124" stroke-opacity=".22" stroke-width="4"/>
        ${isRainbowFruit(fruit) ? '<circle cx="64" cy="64" r="58" fill="url(#rainbow-shine)"/>' : ''}
      </g>
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

function createRainbowGradient(context, radius, time) {
  if (typeof context.createConicGradient === 'function') {
    const gradient = context.createConicGradient(-Math.PI / 2 + time * 0.00055, 0, 0);
    RAINBOW_STOPS.forEach(([offset, color]) => gradient.addColorStop(Number.parseFloat(offset) / 100, color));
    return gradient;
  }

  const angle = time * 0.00055;
  const dx = Math.cos(angle) * radius;
  const dy = Math.sin(angle) * radius;
  const gradient = context.createLinearGradient(-dx, -dy, dx, dy);
  RAINBOW_STOPS.forEach(([offset, color]) => gradient.addColorStop(Number.parseFloat(offset) / 100, color));
  return gradient;
}

function drawRainbowShine(context, radius, time) {
  const highlightAngle = time * 0.0012;
  const highlightX = -radius * 0.22 + Math.cos(highlightAngle) * radius * 0.12;
  const highlightY = -radius * 0.22 + Math.sin(highlightAngle) * radius * 0.12;
  const shine = context.createRadialGradient(
    highlightX - radius * 0.2,
    highlightY - radius * 0.2,
    radius * 0.04,
    highlightX,
    highlightY,
    radius * 1.08,
  );
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.58)');
  shine.addColorStop(0.42, 'rgba(255, 255, 255, 0.08)');
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = shine;
  context.fill();
}

export function drawColorFruit(context, body) {
  const fruit = body.fruitRender;
  if (!body || !isColorFruit(fruit) || body.render.visible !== false) return;

  const radius = body.circleRadius || fruit.radius;
  const scaleX = body.visual?.scaleX || 1;
  const scaleY = body.visual?.scaleY || 1;
  const opacity = body.render.opacity ?? 1;
  const time = typeof performance === 'undefined' ? Date.now() : performance.now();
  const rainbow = isRainbowFruit(fruit);
  const pulse = rainbow ? 1 + Math.sin(time * 0.0045) * 0.025 : 1;

  context.save();
  context.globalAlpha = opacity;
  context.translate(body.position.x, body.position.y);
  context.rotate(body.angle || 0);
  context.scale(scaleX * pulse, scaleY * pulse);
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fillStyle = rainbow ? createRainbowGradient(context, radius, time) : getFruitColor(fruit);
  context.fill();
  if (rainbow) {
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    drawRainbowShine(context, radius, time);
  }
  context.lineWidth = Math.max(1.5, radius * 0.06);
  context.strokeStyle = fruit.strokeColor || (rainbow ? 'rgba(255, 255, 255, 0.72)' : 'rgba(32, 33, 36, 0.18)');
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
  if (rainbow) {
    context.lineWidth = Math.max(2, radius * 0.035);
    context.strokeStyle = 'rgba(24, 0, 48, 0.42)';
    context.strokeText(text, 0, 0);
  }
  context.fillText(text, 0, 0);
  context.restore();
}

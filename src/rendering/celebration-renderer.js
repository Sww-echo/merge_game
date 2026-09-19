export const CELEBRATION_DURATION = 4200;

function now() {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function drawSparkle(context, size) {
  context.beginPath();
  context.moveTo(0, -size);
  context.lineTo(size * 0.28, -size * 0.28);
  context.lineTo(size, 0);
  context.lineTo(size * 0.28, size * 0.28);
  context.lineTo(0, size);
  context.lineTo(-size * 0.28, size * 0.28);
  context.lineTo(-size, 0);
  context.lineTo(-size * 0.28, -size * 0.28);
  context.closePath();
  context.fill();
}

function drawCelebrationMessage(context, elapsed) {
  const text = '恭喜你成为了伟子';
  const width = context.canvas.width;
  const height = context.canvas.height;
  const drift = (elapsed * 0.045) % 180;
  const colors = ['#ff1744', '#ff8f00', '#ffe600', '#23e65b', '#00d9ff', '#2979ff', '#d500f9'];

  context.save();
  context.globalAlpha = 0.64;
  context.translate(width / 2, height / 2);
  context.rotate(-0.1);
  context.translate(-width / 2, -height / 2);
  context.font = '900 21px "Azeret Mono", "PingFang SC", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(24, 0, 48, 0.32)';
  context.shadowBlur = 5;

  const columns = Math.ceil(width / 145) + 2;
  const rows = Math.ceil(height / 58) + 2;
  for (let row = -1; row < rows; row += 1) {
    for (let column = -1; column < columns; column += 1) {
      const x = column * 145 - 30 + drift;
      const y = row * 58 - 28;
      const colorIndex = (row + column + Math.floor(elapsed / 180)) % colors.length;
      context.fillStyle = colors[(colorIndex + colors.length) % colors.length];
      context.fillText(text, x, y);
    }
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.96;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '900 42px "Azeret Mono", "PingFang SC", sans-serif';
  context.lineWidth = 11;
  context.strokeStyle = 'rgba(24, 0, 48, 0.72)';
  context.strokeText(text, width / 2, height * 0.2);
  const headline = context.createLinearGradient(width * 0.18, 0, width * 0.82, 0);
  headline.addColorStop(0, '#ffe600');
  headline.addColorStop(0.25, '#ff1744');
  headline.addColorStop(0.5, '#ffffff');
  headline.addColorStop(0.75, '#00d9ff');
  headline.addColorStop(1, '#d500f9');
  context.fillStyle = headline;
  context.fillText(text, width / 2, height * 0.2);
  context.font = '900 58px "Azeret Mono", "PingFang SC", sans-serif';
  context.lineWidth = 14;
  context.strokeText('伟子诞生！', width / 2, height * 0.52);
  context.fillText('伟子诞生！', width / 2, height * 0.52);
  context.restore();
}

function drawCelebrationBeams(context, celebration, elapsed) {
  const pulse = 0.85 + Math.sin(elapsed * 0.01) * 0.15;
  const colors = ['#ff1744', '#ffe600', '#00d9ff', '#d500f9'];

  context.save();
  context.translate(celebration.x, celebration.y);
  context.globalAlpha = 0.2 * pulse;
  context.lineWidth = 8;
  for (let index = 0; index < 28; index += 1) {
    const angle = (Math.PI * 2 * index) / 28 + elapsed * 0.00035;
    const inner = celebration.radius * 0.6;
    const outer = celebration.radius * (2.1 + pulse * 0.8);
    context.strokeStyle = colors[index % colors.length];
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.stroke();
  }
  context.restore();
}

export function renderCelebration(context, celebration) {
  if (!celebration) return;

  const elapsed = now() - celebration.startedAt;
  if (elapsed < 0 || elapsed > CELEBRATION_DURATION) return;

  const progress = elapsed / CELEBRATION_DURATION;
  const seconds = elapsed / 1000;

  context.save();
  context.translate(celebration.x, celebration.y);

  const flashAlpha = Math.max(0, 0.16 - progress * 0.16);
  context.globalAlpha = flashAlpha;
  context.fillStyle = '#ffffff';
  context.fillRect(-celebration.x, -celebration.y, context.canvas.width, context.canvas.height);

  celebration.bursts.forEach((burst) => {
    const burstElapsed = elapsed - burst.delay;
    if (burstElapsed < 0) return;

    const burstProgress = Math.min(1, burstElapsed / 1150);
    const burstSeconds = burstElapsed / 1000;
    const ringAlpha = Math.max(0, 0.65 - burstProgress * 0.65);
    context.save();
    context.translate(burst.x, burst.y);
    context.globalAlpha = ringAlpha;
    context.lineWidth = 4;
    context.strokeStyle = burst.color;
    context.beginPath();
    context.arc(0, 0, celebration.radius * 0.4 + burstProgress * celebration.radius * 1.6, 0, Math.PI * 2);
    context.stroke();

    context.globalAlpha = Math.max(0, 0.5 - burstProgress * 0.5);
    context.lineWidth = 3;
    for (let ray = 0; ray < 12; ray += 1) {
      const angle = (Math.PI * 2 * ray) / 12 + burstSeconds * 0.45;
      const inner = celebration.radius * 0.55 + burstProgress * celebration.radius * 0.8;
      const outer = inner + celebration.radius * 0.32;
      context.beginPath();
      context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      context.stroke();
    }
    context.restore();
  });

  celebration.particles.forEach((particle) => {
    const particleElapsed = elapsed - particle.delay;
    if (particleElapsed < 0) return;
    const particleSeconds = particleElapsed / 1000;
    const particleProgress = Math.min(1, particleElapsed / particle.duration);
    const x = particle.originX + particle.vx * particleSeconds;
    const y = particle.originY + particle.vy * particleSeconds + particle.gravity * particleSeconds * particleSeconds * 0.5;
    const alpha = Math.max(0, 1 - particleProgress * 1.15);
    if (alpha <= 0) return;

    context.save();
    context.translate(x, y);
    context.rotate(particle.rotation + particle.spin * particleSeconds);
    context.globalAlpha = alpha;
    context.fillStyle = particle.color;

    if (particle.kind === 'sparkle') {
      drawSparkle(context, particle.size * (1 - particleProgress * 0.2));
    } else {
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.58);
    }
    context.restore();
  });

  context.restore();
  drawCelebrationBeams(context, celebration, elapsed);
  drawCelebrationMessage(context, elapsed);
}

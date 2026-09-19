export const CELEBRATION_DURATION = 3600;

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
}

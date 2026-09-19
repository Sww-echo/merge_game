const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class SquashSystem {
  constructor({ recoverySpeed = 0.16, maxStretch = 0.16 } = {}) {
    this.recoverySpeed = recoverySpeed;
    this.maxStretch = maxStretch;
  }

  registerImpact(body, impact, axis = 'vertical') {
    if (!body || body.isStatic || !body.visual) return;

    const strength = clamp(impact / 12, 0.08, 1);
    const stretch = strength * this.maxStretch;

    if (axis === 'horizontal') {
      body.visual.targetScaleX = 1 - stretch;
      body.visual.targetScaleY = 1 + stretch;
    } else {
      body.visual.targetScaleX = 1 + stretch;
      body.visual.targetScaleY = 1 - stretch;
    }
  }

  updateBody(body) {
    if (!body?.visual) return;

    const visual = body.visual;
    visual.scaleX += (visual.targetScaleX - visual.scaleX) * this.recoverySpeed;
    visual.scaleY += (visual.targetScaleY - visual.scaleY) * this.recoverySpeed;

    if (body.render?.sprite) {
      body.render.sprite.xScale = visual.baseScale * visual.scaleX;
      body.render.sprite.yScale = visual.baseScale * visual.scaleY;
    }

    visual.targetScaleX += (1 - visual.targetScaleX) * this.recoverySpeed * 0.5;
    visual.targetScaleY += (1 - visual.targetScaleY) * this.recoverySpeed * 0.5;
  }

  updateBodies(bodies) {
    bodies.forEach((body) => this.updateBody(body));
  }
}

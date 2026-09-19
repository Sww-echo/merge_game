export const PHYSICS_CONFIG = {
  gravity: 1,
  restitution: 0.65,
  friction: 0.006,
  frictionStatic: 0.006,
  frictionAir: 0,
  velocityIterations: 8,
  positionIterations: 8,
};

export const getBodyPhysics = (overrides = {}) => ({
  friction: PHYSICS_CONFIG.friction,
  frictionStatic: PHYSICS_CONFIG.frictionStatic,
  frictionAir: PHYSICS_CONFIG.frictionAir,
  restitution: PHYSICS_CONFIG.restitution,
  ...overrides,
});

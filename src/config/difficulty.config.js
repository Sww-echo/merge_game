export const DEFAULT_DIFFICULTY = 'normal';

export const DIFFICULTY_LEVELS = Object.freeze({
  easy: Object.freeze({
    label: '轻松',
    description: '下落更慢，反弹更明显，且跳过 211 阶段。',
    gravity: 0.78,
    restitution: 0.78,
    frictionAir: 0.002,
    previewDelay: 360,
    loseHeight: 58,
    skipFruitIds: ['circle7'],
  }),
  normal: Object.freeze({
    label: '标准',
    description: '保持经典节奏，适合大多数玩家，跳过 211 阶段。',
    gravity: 1,
    restitution: 0.65,
    frictionAir: 0,
    previewDelay: 500,
    loseHeight: 84,
    skipFruitIds: ['circle7'],
  }),
  hard: Object.freeze({
    label: '挑战',
    description: '下落更快，反弹更克制，包含完整的 211 阶段。',
    gravity: 1.22,
    restitution: 0.54,
    frictionAir: 0.004,
    previewDelay: 360,
    loseHeight: 112,
    skipFruitIds: [],
  }),
});

export function getDifficulty(id) {
  return DIFFICULTY_LEVELS[id]
    ? { id, ...DIFFICULTY_LEVELS[id] }
    : { id: DEFAULT_DIFFICULTY, ...DIFFICULTY_LEVELS[DEFAULT_DIFFICULTY] };
}

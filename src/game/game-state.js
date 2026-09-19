export const GAME_STATES = Object.freeze({
  MENU: 'menu',
  READY: 'ready',
  DROP: 'drop',
  LOSE: 'lose',
});

export function createGameState(fruitCount) {
  return {
    state: GAME_STATES.MENU,
    score: 0,
    highscore: 0,
    fruitsMerged: Array.from({ length: fruitCount }, () => 0),
    currentFruitIndex: 0,
    nextFruitIndex: 0,
    previewBall: null,
  };
}

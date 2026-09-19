import { GameController } from './game/game-controller.js';
import { GAME_CONFIG } from './config/game.config.js';
import { loadResources } from './resources/resource-loader.js';
import { initResourceEditor } from './resources/resource-editor.js';

const elements = {
  canvas: document.getElementById('game-canvas'),
  ui: document.getElementById('game-ui'),
  score: document.getElementById('game-score'),
  statusValue: document.getElementById('game-highscore-value'),
  nextFruitImg: document.getElementById('game-next-fruit'),
  end: document.getElementById('game-end-container'),
  endTitle: document.getElementById('game-end-title'),
  endScore: document.getElementById('game-end-score'),
  endStatus: document.getElementById('game-end-status'),
  startButton: document.getElementById('game-start-button'),
  playerName: document.getElementById('player-name'),
  sideScore: document.getElementById('side-score'),
  sideHighscore: document.getElementById('side-highscore'),
  sideNextFruit: document.getElementById('side-next-fruit'),
  sideNextFruitName: document.getElementById('side-next-fruit-name'),
  scoreSaveStatus: document.getElementById('score-save-status'),
  leaderboard: document.getElementById('leaderboard'),
  difficulty: document.getElementById('game-difficulty'),
  difficultyNote: document.getElementById('difficulty-note'),
  difficultyBadge: document.getElementById('difficulty-badge'),
};

async function bootstrap() {
  try {
    const resources = await loadResources();
    const game = new GameController({
      Matter: window.Matter,
      resources,
      elements,
    });

    initResourceEditor(resources);
    game.init();
    window.suikaGame = game;
    resizeCanvas();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<pre class="startup-error">Unable to start game:\n${error.message}</pre>`;
  }
}

function resizeCanvas() {
  const game = window.suikaGame;
  if (!game?.render?.canvas) return;

  const stage = document.getElementById('game-stage');
  const availableWidth = Math.max(260, stage.clientWidth - 20);
  const availableHeight = Math.max(430, window.innerHeight - 280);
  const scaleUI = Math.min(
    1,
    availableWidth / GAME_CONFIG.width,
    availableHeight / GAME_CONFIG.height,
  );
  const newWidth = Math.floor(GAME_CONFIG.width * scaleUI);
  const newHeight = Math.floor(GAME_CONFIG.height * scaleUI);

  game.render.canvas.style.width = `${newWidth}px`;
  game.render.canvas.style.height = `${newHeight}px`;
  elements.ui.style.width = `${GAME_CONFIG.width}px`;
  elements.ui.style.height = `${GAME_CONFIG.height}px`;
  elements.ui.style.transform = `scale(${scaleUI})`;
}

window.addEventListener('resize', resizeCanvas);

bootstrap();

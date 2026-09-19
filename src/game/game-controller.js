import { GAME_CONFIG } from '../config/game.config.js';
import { getBodyPhysics, PHYSICS_CONFIG } from '../config/physics.config.js';
import { DEFAULT_DIFFICULTY, getDifficulty } from '../config/difficulty.config.js';
import { GAME_STATES, createGameState } from './game-state.js';
import { resolveResourceUrl } from '../resources/resource-loader.js';
import { getFruitPreviewUrl, isColorFruit } from '../resources/fruit-visual.js';
import { renderColorFruits } from '../rendering/color-fruit-renderer.js';
import { SquashSystem } from '../physics/squash-system.js';
import { getPlayerProfile, loadScores, savePlayerName, saveScore } from '../services/score-service.js';

const random = (() => {
  let seed = Date.now();
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
})();

const getImpact = (bodyA, bodyB) => {
  const velocityX = bodyA.velocity.x - bodyB.velocity.x;
  const velocityY = bodyA.velocity.y - bodyB.velocity.y;
  return Math.sqrt(velocityX ** 2 + velocityY ** 2);
};

export class GameController {
  constructor({ Matter, resources, elements }) {
    this.Matter = Matter;
    this.resources = resources;
    this.elements = elements;
    this.fruits = resources.fruits;
    this.fruitIndexById = new Map(this.fruits.map((fruit, index) => [fruit.id, index]));
    this.spawnableFruitIndexes = this.fruits
      .map((fruit, index) => fruit.spawnable === false ? null : index)
      .filter((index) => index !== null);
    this.state = createGameState(this.fruits.length);
    this.squashSystem = new SquashSystem();
    this.sounds = new Map();
    this.scoreSubmitted = false;

    const { Engine, Render, Runner, Mouse, MouseConstraint } = Matter;
    this.engine = Engine.create({
      velocityIterations: PHYSICS_CONFIG.velocityIterations,
      positionIterations: PHYSICS_CONFIG.positionIterations,
    });
    this.engine.gravity.y = PHYSICS_CONFIG.gravity;
    this.render = Render.create({
      element: elements.canvas,
      engine: this.engine,
      options: {
        width: GAME_CONFIG.width,
        height: GAME_CONFIG.height,
        wireframes: false,
        background: '#f4c96b',
      },
    });
    this.runner = Runner.create();
    this.difficulty = getDifficulty(this.getStoredDifficulty());
    this.engine.gravity.y = this.difficulty.gravity;
    this.mouse = Mouse.create(this.render.canvas);
    this.mouseConstraint = MouseConstraint.create(this.engine, {
      mouse: this.mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false },
      },
    });
    this.render.mouse = this.mouse;
    this.menuStatics = this.createMenuStatics();
    this.gameStatics = this.createGameStatics();
  }

  getStoredDifficulty() {
    try {
      return localStorage.getItem('suika-game-difficulty') || this.elements.difficulty?.value || DEFAULT_DIFFICULTY;
    } catch {
      return this.elements.difficulty?.value || DEFAULT_DIFFICULTY;
    }
  }

  setDifficulty(id) {
    this.difficulty = getDifficulty(id);
    this.engine.gravity.y = this.difficulty.gravity;
    if (this.elements.difficulty && this.elements.difficulty.value !== this.difficulty.id) {
      this.elements.difficulty.value = this.difficulty.id;
    }
    if (this.elements.difficultyNote) this.elements.difficultyNote.innerText = this.difficulty.description;
    if (this.elements.difficultyBadge) {
      this.elements.difficultyBadge.innerText = `${this.difficulty.label} · 弹性 ${this.difficulty.restitution.toFixed(2)}`;
    }
    return this.difficulty;
  }

  getCurrentBodyPhysics(overrides = {}) {
    return getBodyPhysics({
      restitution: this.difficulty.restitution,
      frictionAir: this.difficulty.frictionAir,
      ...overrides,
    });
  }

  init() {
    const { Render, Runner, Composite, Events } = this.Matter;
    Render.run(this.render);
    Runner.run(this.runner, this.engine);
    Composite.add(this.engine.world, this.menuStatics);
    this.loadHighscore();
    this.elements.playerName.value = getPlayerProfile().name;
    this.elements.playerName.addEventListener('change', () => {
      this.elements.playerName.value = savePlayerName(this.elements.playerName.value);
    });
    this.loadLeaderboard();
    this.elements.scoreSaveStatus.innerText = '等待开始';
    this.setDifficulty(this.difficulty.id);
    if (this.elements.difficulty) {
      this.elements.difficulty.disabled = false;
      this.elements.difficulty.addEventListener('change', () => {
        const selected = this.setDifficulty(this.elements.difficulty.value);
        try {
          localStorage.setItem('suika-game-difficulty', selected.id);
        } catch {
          // Continue without persistence when storage is unavailable.
        }
      });
    }
    this.elements.ui.style.display = 'none';
    this.elements.startButton.style.display = 'block';
    this.elements.startButton.addEventListener('click', () => {
      if (this.state.state === GAME_STATES.MENU) this.startGame();
    });

    Events.on(this.mouseConstraint, 'mousedown', (event) => this.handleMouseDown(event));
    Events.on(this.mouseConstraint, 'mousemove', (event) => this.handleMouseMove(event));
    Events.on(this.mouseConstraint, 'mouseup', (event) => this.handleMouseUp(event));
    this.elements.canvas.addEventListener('click', (event) => {
      if (event.target.tagName !== 'CANVAS' || this.state.state !== GAME_STATES.READY) return;

      const rect = event.target.getBoundingClientRect();
      const x = (event.clientX - rect.left) * GAME_CONFIG.width / rect.width;
      this.addFruit(x);
    });
    Events.on(this.engine, 'collisionStart', (event) => this.handleCollisions(event));
    Events.on(this.engine, 'afterUpdate', () => {
      this.squashSystem.updateBodies(this.Matter.Composite.allBodies(this.engine.world));
    });
    Events.on(this.render, 'afterRender', () => renderColorFruits(this.render, this.Matter));
  }

  playSound(path) {
    if (!path) return;
    const url = resolveResourceUrl(path);
    if (!this.sounds.has(url)) this.sounds.set(url, new Audio(url));
    const sound = this.sounds.get(url);
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  createMenuStatics() {
    const { Bodies } = this.Matter;
    const assets = this.resources.assets;
    const centerX = GAME_CONFIG.width / 2;
    const centerY = GAME_CONFIG.height * 0.4;
    const radius = 64;

    return [
      Bodies.rectangle(centerX, centerY, 512, 512, {
        isStatic: true,
        render: { sprite: { texture: resolveResourceUrl(assets.menuBackground) } },
      }),
      ...this.fruits.map((fruit, index) => {
        const body = Bodies.circle(
          centerX + 192 * Math.cos((Math.PI * 2 * index) / 12),
          centerY + 192 * Math.sin((Math.PI * 2 * index) / 12),
          radius,
          {
            isStatic: true,
            render: isColorFruit(fruit)
              ? { visible: false, fillStyle: fruit.color }
              : { sprite: {
                texture: resolveResourceUrl(fruit.texture),
                xScale: radius / 1024,
                yScale: radius / 1024,
              } },
          },
        );
        body.fruitRender = fruit;
        return body;
      }),
      Bodies.rectangle(centerX, GAME_CONFIG.height * 0.75, 512, 96, {
        isStatic: true,
        label: 'btn-start',
        render: { sprite: { texture: resolveResourceUrl(assets.startButton) } },
      }),
    ];
  }

  createGameStatics() {
    const { Bodies } = this.Matter;
    const wallProps = {
      isStatic: true,
      render: { fillStyle: '#f6dc8f' },
      ...this.getCurrentBodyPhysics(),
    };

    return [
      Bodies.rectangle(-(GAME_CONFIG.wallPad / 2), GAME_CONFIG.height / 2, GAME_CONFIG.wallPad, GAME_CONFIG.height, {
        ...wallProps,
        label: 'game-wall-left',
      }),
      Bodies.rectangle(GAME_CONFIG.width + (GAME_CONFIG.wallPad / 2), GAME_CONFIG.height / 2, GAME_CONFIG.wallPad, GAME_CONFIG.height, {
        ...wallProps,
        label: 'game-wall-right',
      }),
      Bodies.rectangle(
        GAME_CONFIG.width / 2,
        GAME_CONFIG.height + (GAME_CONFIG.wallPad / 2) - GAME_CONFIG.statusBarHeight,
        GAME_CONFIG.width,
        GAME_CONFIG.wallPad,
        { ...wallProps, label: 'game-floor' },
      ),
    ];
  }

  getFruitIndex(body) {
    return this.fruitIndexById.get(body?.fruitId);
  }

  generateFruitBody(x, y, fruitIndex, extraConfig = {}) {
    const { Bodies } = this.Matter;
    const fruit = this.fruits[fruitIndex];
    const radius = fruit.radius;
    const baseScale = radius / 512;
    const body = Bodies.circle(x, y, radius, {
      ...this.getCurrentBodyPhysics(fruit.physics),
      ...extraConfig,
      render: {
        ...(isColorFruit(fruit)
          ? { visible: false, fillStyle: fruit.color }
          : { sprite: {
            texture: resolveResourceUrl(fruit.texture),
            xScale: baseScale,
            yScale: baseScale,
          } }),
      },
    });

    body.fruitId = fruit.id;
    body.fruitRender = fruit;
    body.popped = false;
    body.visual = {
      baseScale,
      scaleX: 1,
      scaleY: 1,
      targetScaleX: 1,
      targetScaleY: 1,
    };
    return body;
  }

  setNextFruit() {
    const randomIndex = Math.floor(random() * this.spawnableFruitIndexes.length);
    this.state.nextFruitIndex = this.spawnableFruitIndexes[randomIndex];
    const fruit = this.fruits[this.state.nextFruitIndex];
    const previewUrl = getFruitPreviewUrl(fruit);
    this.elements.nextFruitImg.src = isColorFruit(fruit) ? previewUrl : resolveResourceUrl(previewUrl);
    this.elements.sideNextFruit.src = isColorFruit(fruit) ? previewUrl : resolveResourceUrl(previewUrl);
    this.elements.sideNextFruitName.innerText = fruit.name;
  }

  calculateScore() {
    this.state.score = this.state.fruitsMerged.reduce((total, count, index) => (
      total + this.fruits[index].score * count
    ), 0);
    this.elements.score.innerText = this.state.score;
    this.elements.sideScore.innerText = this.state.score;
    this.elements.endScore.innerText = this.state.score;
  }

  loadHighscore() {
    try {
      const cache = JSON.parse(localStorage.getItem('suika-game-cache') || '{"highscore":0}');
      this.state.highscore = Number(cache.highscore) || 0;
    } catch {
      this.state.highscore = 0;
    }
    this.elements.statusValue.innerText = this.state.highscore;
    this.elements.sideHighscore.innerText = this.state.highscore;
  }

  saveHighscore() {
    this.calculateScore();
    if (this.state.score < this.state.highscore) return;

    this.state.highscore = this.state.score;
    this.elements.statusValue.innerText = this.state.highscore;
    this.elements.sideHighscore.innerText = this.state.highscore;
    this.elements.endTitle.innerText = 'New Highscore!';
    localStorage.setItem('suika-game-cache', JSON.stringify({ highscore: this.state.highscore }));
  }

  startGame() {
    const { Composite } = this.Matter;
    this.setDifficulty(this.elements.difficulty?.value || this.difficulty.id);
    this.playSound(this.resources.assets.clickSound);
    this.elements.startButton.style.display = 'none';
    this.elements.canvas.classList.add('is-playing');
    if (this.elements.difficulty) this.elements.difficulty.disabled = true;
    this.scoreSubmitted = false;
    this.elements.scoreSaveStatus.innerText = '游戏进行中';
    Composite.remove(this.engine.world, this.menuStatics);
    this.gameStatics = this.createGameStatics();
    Composite.add(this.engine.world, this.gameStatics);
    this.state.state = GAME_STATES.DROP;
    this.state.fruitsMerged.fill(0);
    this.calculateScore();
    this.elements.endTitle.innerText = 'Game Over!';
    this.elements.ui.style.display = 'block';
    this.elements.end.style.display = 'none';
    this.state.currentFruitIndex = 0;
    this.setNextFruit();
    this.state.previewBall = this.generateFruitBody(
      GAME_CONFIG.width / 2,
      GAME_CONFIG.previewBallHeight,
      this.state.currentFruitIndex,
      { isStatic: true, collisionFilter: { mask: 0x0040 } },
    );
    Composite.add(this.engine.world, this.state.previewBall);

    window.setTimeout(() => {
      this.state.state = GAME_STATES.READY;
    }, 250);
  }

  handleMouseDown() {
    if (this.state.state === GAME_STATES.MENU) {
      const clickedBody = this.mouseConstraint.body;
      if (clickedBody?.label === 'btn-start') this.startGame();
    }
  }

  handleMouseMove(event) {
    if (this.state.state !== GAME_STATES.READY || !this.state.previewBall) return;
    this.state.previewBall.position.x = event.mouse.position.x;
  }

  handleMouseUp(event) {
    if (this.state.state !== GAME_STATES.READY) return;
    this.addFruit(event.mouse.position.x);
  }

  addFruit(x) {
    const { Composite } = this.Matter;
    this.playSound(this.resources.assets.clickSound);
    this.state.state = GAME_STATES.DROP;

    const latestFruit = this.generateFruitBody(x, GAME_CONFIG.previewBallHeight, this.state.currentFruitIndex);
    Composite.add(this.engine.world, latestFruit);

    this.state.currentFruitIndex = this.state.nextFruitIndex;
    this.setNextFruit();
    this.calculateScore();
    Composite.remove(this.engine.world, this.state.previewBall);
    this.state.previewBall = this.generateFruitBody(
      this.mouse.position.x,
      GAME_CONFIG.previewBallHeight,
      this.state.currentFruitIndex,
      { isStatic: true, collisionFilter: { mask: 0x0040 } },
    );

    window.setTimeout(() => {
      if (this.state.state !== GAME_STATES.DROP) return;
      Composite.add(this.engine.world, this.state.previewBall);
      this.state.state = GAME_STATES.READY;
    }, GAME_CONFIG.previewDelay);
  }

  handleCollisions(event) {
    event.pairs.forEach(({ bodyA, bodyB }) => {
      const fruitA = this.getFruitIndex(bodyA);
      const fruitB = this.getFruitIndex(bodyB);
      const impact = getImpact(bodyA, bodyB);
      const staticBody = bodyA.isStatic ? bodyA : bodyB.isStatic ? bodyB : null;
      const dynamicBody = bodyA.isStatic ? bodyB : bodyB.isStatic ? bodyA : null;

      if (staticBody && dynamicBody?.fruitId) {
        const axis = staticBody.label === 'game-floor' ? 'vertical' : 'horizontal';
        this.squashSystem.registerImpact(dynamicBody, impact, axis);
      } else if (fruitA !== undefined && fruitB !== undefined) {
        this.squashSystem.registerImpact(bodyA, impact, 'vertical');
        this.squashSystem.registerImpact(bodyB, impact, 'vertical');
      }

      if (bodyA.isStatic || bodyB.isStatic) return;
      if (fruitA === undefined || fruitB === undefined) return;

      const aY = bodyA.position.y + bodyA.circleRadius;
      const bY = bodyB.position.y + bodyB.circleRadius;
      if (aY < this.difficulty.loseHeight || bY < this.difficulty.loseHeight) {
        this.loseGame();
        return;
      }

      if (bodyA.fruitId !== bodyB.fruitId || bodyA.popped || bodyB.popped) return;
      this.mergeFruits(bodyA, bodyB, fruitA);
    });
  }

  mergeFruits(bodyA, bodyB, fruitIndex) {
    const { Composite } = this.Matter;
    const fruit = this.fruits[fruitIndex];
    const nextIndex = this.fruitIndexById.get(fruit.mergeTo);
    if (nextIndex === undefined) return;

    bodyA.popped = true;
    bodyB.popped = true;
    this.state.fruitsMerged[fruitIndex] += 1;
    this.playSound(fruit.popSound);

    const midPosX = (bodyA.position.x + bodyB.position.x) / 2;
    const midPosY = (bodyA.position.y + bodyB.position.y) / 2;
    Composite.remove(this.engine.world, [bodyA, bodyB]);
    Composite.add(this.engine.world, this.generateFruitBody(midPosX, midPosY, nextIndex));
    this.addPop(midPosX, midPosY, bodyA.circleRadius);
    this.calculateScore();
  }

  addPop(x, y, radius) {
    const { Bodies, Composite } = this.Matter;
    const circle = Bodies.circle(x, y, radius, {
      isStatic: true,
      collisionFilter: { mask: 0x0040 },
      angle: random() * Math.PI * 2,
      render: {
        sprite: {
          texture: resolveResourceUrl(this.resources.assets.popEffect),
          xScale: radius / 384,
          yScale: radius / 384,
        },
      },
    });

    Composite.add(this.engine.world, circle);
    window.setTimeout(() => Composite.remove(this.engine.world, circle), 100);
  }

  loseGame() {
    if (this.state.state === GAME_STATES.LOSE) return;
    this.state.state = GAME_STATES.LOSE;
    this.elements.end.style.display = 'flex';
    if (this.elements.difficulty) this.elements.difficulty.disabled = false;
    this.runner.enabled = false;
    this.saveHighscore();
    this.elements.endStatus.innerText = '正在保存成绩…';
    this.elements.scoreSaveStatus.innerText = '正在保存…';
    this.submitScore();
  }

  async loadLeaderboard() {
    try {
      const { scores } = await loadScores(5);
      this.elements.leaderboard.replaceChildren();

      if (scores.length === 0) {
        const empty = document.createElement('li');
        empty.innerHTML = '<span class="rank">—</span><span class="name">暂无成绩</span><span class="score">0</span>';
        this.elements.leaderboard.append(empty);
        return;
      }

      scores.forEach((record, index) => {
        const row = document.createElement('li');
        const rank = document.createElement('span');
        const name = document.createElement('span');
        const score = document.createElement('span');
        rank.className = 'rank';
        name.className = 'name';
        score.className = 'score';
        rank.innerText = `${index + 1}`;
        name.innerText = record.name;
        score.innerText = record.score;
        row.append(rank, name, score);
        this.elements.leaderboard.append(row);
      });
    } catch {
      this.elements.scoreSaveStatus.innerText = '服务未启动';
    }
  }

  async submitScore() {
    if (this.scoreSubmitted) return;
    this.scoreSubmitted = true;

    try {
      const name = savePlayerName(this.elements.playerName.value);
      this.elements.playerName.value = name;
      const result = await saveScore({ score: this.state.score, name });
      this.elements.endStatus.innerText = `已保存到排行榜 · 第 ${result.rank} 名`;
      this.elements.scoreSaveStatus.innerText = `已保存 · 第 ${result.rank} 名`;
      await this.loadLeaderboard();
    } catch {
      this.elements.endStatus.innerText = '保存失败，请确认 Node 服务已启动';
      this.elements.scoreSaveStatus.innerText = '保存失败';
    }
  }
}

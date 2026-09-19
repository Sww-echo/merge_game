# 合成伟子 / Suika Lab

![](./screenshot.png)

Built with Vite, modular JavaScript, and the [matter.js](https://github.com/liabru/matter-js) physics engine.

## Development

```bash
npm install
npm run dev
```

成绩服务需要单独启动：

```bash
npm run service
```

开发时打开 Vite 地址；Vite 会把 `/api/scores` 转发到 `127.0.0.1:8787`。生产环境先构建，再运行 `npm start`，它会同时提供 `dist` 静态文件和成绩 API。

Production output is generated with:

```bash
npm run build
npm run preview
```

## Custom fruits and resources

Fruit definitions live in [`public/resources.json`](./public/resources.json). Add an image or sound under `public/assets/`, then reference it from the manifest. Each fruit supports its own radius, score, texture, sound, merge target, spawnable flag, and optional physics overrides.

页面中的“资源配置”编辑器可以直接修改基础资源路径和水果配置，并通过 `/api/resources` 保存到 [`data/resources.json`](./data/resources.json)。保存后刷新页面生效；新增图片或音效时，先将文件放入 `public/assets/`，再在编辑器中填写相对路径。

水果支持两种显示类型：`texture` 使用图片纹理，`color` 使用纯色圆球。纯色圆球可以通过 `color`、`text` 和 `textColor` 定义颜色与圆心文字：

```json
{
  "id": "blue-7",
  "name": "蓝色 7",
  "renderMode": "color",
  "color": "#b9d8ff",
  "text": "7",
  "textColor": "#202124",
  "radius": 48,
  "score": 7,
  "popSound": "assets/pop0.mp3",
  "mergeTo": "circle1",
  "spawnable": true
}
```

`texture` 模式仍然需要填写 `texture` 路径；`color` 模式不需要图片路径。两种模式都会参与弹性、碰撞和落地挤压动画。

The default collision restitution is `0.65`. Touchdown squash is handled visually by `src/physics/squash-system.js`, while Matter.js keeps a stable circular collision body.

游戏页面提供轻松、标准、挑战三档难度。难度会调整重力、反弹、空气阻力、投放间隔和危险线高度，并保存在浏览器本地。页面主题采用极简灰阶风格，水果资源仍由 `public/resources.json` 统一配置。

成绩会由 [`server.js`](./server.js) 校验后追加到 [`data/scores.json`](./data/scores.json)，保存玩家名称、分数、匿名玩家 ID 和时间。页面上的排行榜读取同一个 JSON 文件。

**[Play the game](https://tombofry.github.io/suika-game/)**

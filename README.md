# fraq-plugin-drift-bottle

Fraq 的匿名漂流瓶插件，提供“扔漂流瓶”和“捡漂流瓶”两个指令，并使用 AI 审核脏话与 R18 内容。

需要 Node.js 22.13.0 或更高版本。

## 安装

```bash
pnpm add fraq-plugin-drift-bottle @fraqjs/plugin-ai ai
```

## 使用

```ts
import DriftBottlePlugin from 'fraq-plugin-drift-bottle';

ctx.install(DriftBottlePlugin, {
  storagePath: './data/drift-bottles.db',
  deleteAfterPick: true,
  moderationModel: 'fast',
});
```

使用前需要按照 [Fraq AI 插件文档](https://fraq.dev/docs/plugins/ai) 安装并配置 `@fraqjs/plugin-ai`。`moderationModel` 可选，可以填写 AI 插件中的模型别名或完整模型名；不填写时使用 AI 插件的默认模型。审核会将图片和视频交给模型，因此应选择支持对应媒体输入的模型。

- `扔漂流瓶 <内容>`：匿名保存一条漂流瓶消息，仅支持文字、图片和视频。
- `捡漂流瓶`：随机捡取一条漂流瓶消息。

漂流瓶使用 SQLite 存储。`storagePath` 可选，默认使用运行目录下的 `./data/drift-bottles.db`。

`deleteAfterPick` 控制瓶子被捡取后是否删除，默认为 `true`，瓶子只会被捡到一次；设置为 `false` 可保留瓶子。

# fraq-plugin-drift-bottle

Fraq 漂流瓶插件，支持投递、随机捡取、匿名或别名署名，并使用 AI 审核脏话与 R18 内容。

需要 Node.js 22.13.0 或更高版本。

## 安装

```bash
pnpm add fraq-plugin-drift-bottle @fraqjs/plugin-ai ai zod
```

使用前需按照 [Fraq AI 插件文档](https://fraq.dev/docs/plugins/ai) 安装并配置 `@fraqjs/plugin-ai`。

## 使用

```ts
import DriftBottlePlugin from 'fraq-plugin-drift-bottle';

ctx.install(DriftBottlePlugin, {
  storagePath: './data/drift-bottles.db',
  deleteAfterPick: true,
  moderationModel: 'fast',
});
```

## 配置

所有配置项均为可选。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `storagePath` | `string` | `./data/drift-bottles.db` | SQLite 数据库路径；父目录会自动创建。 |
| `deleteAfterPick` | `boolean` | `true` | `true` 为捡取后删除，`false` 为保留并允许重复捡取。 |
| `moderationModel` | `string` | AI 插件默认模型 | AI 模型别名或 `提供商/模型`；需支持所投递的图片或视频。 |

## 命令

| 命令 | 说明 |
| --- | --- |
| `扔漂流瓶 <内容>` | 投递漂流瓶，支持文字、图片、视频、表情、动态表情和合并转发；非文字内容可通过回复投递。 |
| `捡漂流瓶` | 随机捡取一个漂流瓶。 |
| `漂流瓶署名 匿名` | 后续投递保持匿名。 |
| `漂流瓶署名 <别名>` | 后续投递使用别名，最多 20 个字符。 |

## 行为

- 默认匿名；别名按 QQ 用户保存，旧瓶子不受后续改名影响。
- 内容和别名通过 AI 审核后才会写入数据库。
- AI 审核失败或服务不可用时拒绝投递，不会绕过审核。
- 数据存储在 SQLite 中，旧版数据库会自动迁移。

# fraq-plugin-drift-bottle

Fraq 漂流瓶插件，支持投递、随机捡取、匿名、原名或别名署名，并使用 AI 审核脏话与 R18 内容。

需要 Node.js 22.13.0 或更高版本。

兼容 Fraq 0.14 与 Fraq CLI 0.7。

## 使用 Fraq CLI

在 `fraq.yml` 中先配置 `fraqjs/ai`，再添加 `drift-bottle`：

```yaml
configVersion: 1
fraqVersion: 0.14.0

milky:
  url: http://localhost:30001/

plugins:
  fraqjs/ai:
    providers:
      deepseek:
        sdk: "@ai-sdk/deepseek"
        options:
          apiKey: ${{ env:DEEPSEEK_API_KEY }}
        models: [deepseek-chat]
    defaultModel: deepseek/deepseek-chat

  drift-bottle:
    storagePath: ./data/drift-bottles.db
    moderationModel: deepseek/deepseek-chat
    ownerIds: [123456789]

additionalDependencies:
  "@ai-sdk/deepseek": ^3
  ai: ^7
  zod: ^4
```

然后同步插件版本并启动：

```bash
fraq lock
fraq start
```

Fraq CLI 会把 `drift-bottle` 解析为 npm 包 `fraq-plugin-drift-bottle`，并检查其依赖的 `fraqjs/ai` 插件是否已经配置。

## 代码安装

```bash
pnpm add fraq-plugin-drift-bottle @fraqjs/plugin-ai ai zod
```

使用前需按照 [Fraq AI 插件文档](https://fraq.dev/docs/plugins/ai) 安装并配置 `@fraqjs/plugin-ai`。

```ts
import DriftBottlePlugin from 'fraq-plugin-drift-bottle';

ctx.install(DriftBottlePlugin, {
  storagePath: './data/drift-bottles.db',
  moderationModel: 'fast',
  ownerIds: [123456789],
});
```

## 配置

所有配置项均为可选。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `storagePath` | `string` | `./data/drift-bottles.db` | SQLite 数据库路径；父目录会自动创建。 |
| `moderationModel` | `string` | AI 插件默认模型 | AI 模型别名或 `提供商/模型`；需支持所投递的图片或视频。 |
| `ownerIds` | `number[]` | `[]` | 插件主人 QQ 号；可删除漂流瓶并管理数据库授权列表。 |

## 审核记录

审核记录保存在 SQLite 的 `bottle_moderation_records` 表中。

| 字段 | 说明 |
| --- | --- |
| `id` | 审核记录 ID。 |
| `created_at` | 记录时间，Unix 毫秒时间戳。 |
| `content` | 投稿消息段的 JSON 快照。 |
| `process` | AI 返回的审核结果，失败时为错误名称和信息。 |
| `input_tokens` | 输入 Token，无法获得时为 `NULL`。 |
| `output_tokens` | 输出 Token，无法获得时为 `NULL`。 |
| `total_tokens` | 总 Token，无法获得时为 `NULL`。 |
| `success` | AI 调用成功为 `1`，调用失败为 `0`。 |
| `approved` | 内容通过为 `1`，内容被拒绝为 `0`，调用失败为 `NULL`。 |

## 命令

| 命令 | 说明 |
| --- | --- |
| `扔瓶子 <内容>` | 投递漂流瓶，支持文字、图片、视频、表情、动态表情和合并转发；非文字内容可通过回复投递。 |
| `捡瓶子` | 随机捡取一个漂流瓶。 |
| `评论漂流瓶 <ID> <内容>` | 评论指定漂流瓶；评论仅支持文字，最多 500 个字符，并经过 AI 审核。 |
| `评论漂流瓶 <ID>` | 查看指定漂流瓶的评论，最多显示最新 20 条；也可使用 `漂流瓶评论`。 |
| 回复后发送 `评论漂流瓶 <内容>` | 从被回复的投递确认或捡取消息读取瓶子 ID 并评论；省略内容可查看评论。 |
| `漂流瓶重复捡 开启` | 个人捡取后保留瓶子，允许再次被捡取。 |
| `漂流瓶重复捡 关闭` | 个人捡取后删除瓶子。 |
| `漂流瓶重复捡 默认` | 清除个人设置，恢复默认的捡取后删除行为。 |
| `漂流瓶署名 匿名` | 后续投递保持匿名。 |
| `漂流瓶署名 原名` | 后续投递使用当前群昵称或 QQ 昵称。 |
| `漂流瓶署名 <别名>` | 后续投递使用别名，最多 20 个字符。 |
| `删除漂流瓶 <ID>` | 普通用户只能删除自己投递的瓶子；插件主人、群管和授权列表成员可删除任意瓶子。 |
| `漂流瓶权限 添加 <QQ号或@用户...>` | 将一个或多个用户加入删除权限列表，支持 QQ 号、提及或混合输入；仅插件主人可执行。 |
| `漂流瓶权限 删除 <QQ号或@用户...>` | 将一个或多个用户移出删除权限列表，支持 QQ 号、提及或混合输入；仅插件主人可执行。 |
| `漂流瓶权限 列表` | 查看数据库中的删除权限列表，仅插件主人可执行。 |
| `漂流瓶帮助` | 以合并转发查看帮助，每条消息使用“指令”和“说明”展示一个命令。 |

## 行为

- 默认匿名；署名模式按 QQ 用户保存。原名会在投递时读取当前群昵称或 QQ 昵称，旧瓶子不受后续改名影响。
- 内容和署名通过 AI 审核后才会写入数据库。
- 每次 AI 审核完成后，插件日志会记录输入、输出和总 Token 数量。
- 每次 AI 审核都会写入 SQLite 的 `bottle_moderation_records` 表，包括时间、投稿内容 JSON、审核结果或错误、Token 用量、调用是否成功及内容是否通过。
- R18 审核包含性暗示倾向、敏感部位聚焦或触摸等内容，卡通、动物和表情包采用相同标准。
- AI 审核失败或服务不可用时拒绝投递，不会绕过审核。
- 数据存储在 SQLite 中，旧版数据库会自动迁移。
- 删除权限列表存储在同一个 SQLite 数据库中；群主和群管理员无需加入列表。
- 重复捡取设置按 QQ 用户存储在 SQLite 中，只影响该用户执行 `捡瓶子` 时的行为。
- 捡取后删除只移除瓶子内容，评论索引会保留；使用管理删除命令会同时删除评论。
- 包含图片、视频、表情、动态表情或合并转发的瓶子会先单独发送来源和 ID，再发送瓶子内容。

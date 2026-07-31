# fraq-plugin-drift-bottle

## 加载方式与公开 API

Fraq CLI 会生成独立的 ESM 应用，通过
`ctx.install((await import('fraq-plugin-drift-bottle')).default, options)` 安装本插件。因此默认导出只负责装配，
可复用的漂流瓶操作由命名导出的 `DriftBottleApi` 提供。

其他 Fraq 插件可以声明并注入该服务：

```ts
import { definePlugin } from '@fraqjs/fraq';
import { DriftBottleApi } from 'fraq-plugin-drift-bottle';

export default definePlugin({
  name: 'drift-bottle-consumer',
  requires: [DriftBottleApi],
  inject: { driftBottle: DriftBottleApi },
  async apply(ctx) {
    const count = await ctx.driftBottle.count();
    ctx.logger.info(`当前有 ${count} 个可捡取的漂流瓶`);
  },
});
```

`DriftBottleApi` 提供投递、捡取、评论、署名、删除、权限、重复捡取偏好和审核记录等操作；命令层只负责参数解析和回复构建。源码按职责分为：

- `src/api/`：供命令和其他插件复用的业务 API。
- `src/persistence/`：基于 Kysely 的 SQLite 持久化。
- `src/models/`：公开数据模型。
- `src/processing/`：消息转换、署名解析和 AI 审核处理。
- `src/commands/`：Fraq 命令构建与用户交互。

Fraq 漂流瓶插件，支持投递、随机捡取、匿名、原名或别名署名，并可选择 AI 或人工审核投瓶内容。

需要 Node.js 22.13.0 或更高版本。

兼容 Fraq 0.14 与 Fraq CLI 0.7。

## 使用 Fraq CLI

在 `fraq.yml` 中先配置 `fraqjs/hono`、`fraqjs/ai` 和 `fraqjs/kysely`，再添加 `drift-bottle`：

```yaml
configVersion: 1
fraqVersion: 0.14.0

milky:
  url: http://localhost:30001/

plugins:
  fraqjs/hono:
    host: 127.0.0.1
    port: 4649

  fraqjs/ai:
    providers:
      deepseek:
        sdk: "@ai-sdk/deepseek"
        options:
          apiKey: ${{ env:DEEPSEEK_API_KEY }}
        models: [deepseek-chat]
    defaultModel: deepseek/deepseek-chat

  fraqjs/kysely:
    sqliteUrl: file:./data/drift-bottles.db

  drift-bottle:
    moderationMode: ai
    moderationModel: deepseek/deepseek-chat
    ownerIds: [123456789]
    webuiPath: /drift-bottle

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

Fraq CLI 会把 `drift-bottle` 解析为 npm 包 `fraq-plugin-drift-bottle`，并检查其依赖的 `fraqjs/hono`、`fraqjs/ai` 和 `fraqjs/kysely` 插件是否已经配置。

WebUI 由 Fraq Hono 插件统一提供服务，默认地址为 `http://127.0.0.1:4649/drift-bottle/`。

插件载入时会扫描 `ownerIds`，为其中每个尚无账号的主人创建 WebUI 账号，分别生成一段 6–10 位、同时包含大写字母、小写字母和数字的随机密码，并将密码私聊发送给对应主人。SQLite 仅保存带盐密码哈希；已有账号不会在重启时被覆盖或重复发送，旧版单密码会自动迁移到首位主人账号。

登录后可以在“设置”页面修改当前账号密码。插件主人还可以修改投瓶审核方式、AI 审核模型、主人 QQ 号列表和 WebUI 路径；审核方式、审核模型与主人列表立即生效，WebUI 路径在重启 Fraq 后生效。数据库位置由 `fraqjs/kysely.sqliteUrl` 统一管理。

其他 QQ 号可以在登录页设置 6–10 位、同时包含大小写英文字母和数字的密码并提交注册申请。机器人会私聊所有主人；任一主人引用回复该注册请求并发送：

```text
同意
```

批准后机器人会通知所有主人，并标明同意者的 QQ 昵称和 QQ 号。

## 代码安装

```bash
pnpm add fraq-plugin-drift-bottle @fraqjs/plugin-hono @fraqjs/plugin-ai @fraqjs/plugin-kysely ai kysely zod
```

使用前需按照 [Fraq AI 插件文档](https://fraq.dev/docs/plugins/ai) 安装并配置 `@fraqjs/plugin-ai`。

```ts
import HonoPlugin from '@fraqjs/plugin-hono';
import KyselyPlugin from '@fraqjs/plugin-kysely';
import DriftBottlePlugin from 'fraq-plugin-drift-bottle';

ctx.install(HonoPlugin, { host: '127.0.0.1', port: 4649 });
ctx.install(KyselyPlugin, { sqliteUrl: 'file:./data/drift-bottles.db' });
ctx.install(DriftBottlePlugin, {
  moderationMode: 'ai',
  moderationModel: 'fast',
  ownerIds: [123456789],
});
```

## 配置

所有配置项均为可选。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `moderationMode` | `'ai' \| 'manual'` | `'ai'` | 投瓶审核方式；人工模式会先进入待审核列表，通过后才公开。 |
| `moderationModel` | `string` | AI 插件默认模型 | AI 模型别名或 `提供商/模型`；需支持所投递的图片或视频。 |
| `ownerIds` | `number[]` | `[]` | 插件主人 QQ 号；可删除和审核漂流瓶，并管理数据库授权列表。 |
| `webuiPath` | `string` | `/drift-bottle` | WebUI 在 Fraq Hono 服务上的挂载路径。 |

### 从旧版数据库升级

0.3.17 及更早版本通过本插件的 `storagePath` 直接打开 SQLite。升级后，请删除 `drift-bottle.storagePath`，并把同一文件配置为 Kysely 数据库：

```yaml
plugins:
  fraqjs/kysely:
    sqliteUrl: file:./data/drift-bottles.db

  drift-bottle:
    moderationMode: ai
```

首次启动时，Kysely 会在原文件中登记并执行漂流瓶 schema 迁移；现有表名和数据保持不变。插件不会自动复制或删除旧数据库文件。相对路径仍以 Fraq 进程的工作目录为基准，因此升级前应确认 `sqliteUrl` 指向原 `storagePath` 文件。

## 审核记录

审核记录保存在 SQLite 的 `bottle_moderation_records` 表中。

| 字段 | 说明 |
| --- | --- |
| `id` | 审核记录 ID。 |
| `created_at` | 记录时间，Unix 毫秒时间戳。 |
| `content` | 投稿消息段的 JSON 快照。 |
| `process` | AI 返回的审核结果、错误信息，或等待人工审核状态。 |
| `input_tokens` | 输入 Token，无法获得时为 `NULL`。 |
| `output_tokens` | 输出 Token，无法获得时为 `NULL`。 |
| `total_tokens` | 总 Token，无法获得时为 `NULL`。 |
| `success` | AI 调用成功或成功进入人工队列为 `1`，AI 调用失败为 `0`。 |
| `approved` | 内容通过为 `1`，被 AI 拒绝或等待人工审核为 `0`，调用失败为 `NULL`。 |

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
| `漂流瓶审核 通过 <审核记录ID>` | 通过待审核投瓶并公开；仅插件主人和漂流瓶管理员可执行。 |
| `漂流瓶审核 拒绝 <审核记录ID> <理由>` | 拒绝待审核投瓶并归档，拒绝理由必填；仅插件主人和漂流瓶管理员可执行。 |
| `漂流瓶权限 添加 <QQ号或@用户...>` | 将一个或多个用户加入管理权限列表，使其可以删除和审核漂流瓶；支持 QQ 号、提及或混合输入，仅插件主人可执行。 |
| `漂流瓶权限 删除 <QQ号或@用户...>` | 将一个或多个用户移出管理权限列表，支持 QQ 号、提及或混合输入；仅插件主人可执行。 |
| `漂流瓶权限 列表` | 查看数据库中的漂流瓶管理权限列表，仅插件主人可执行。 |
| `漂流瓶帮助` | 以合并转发查看帮助，每条消息使用“指令”和“说明”展示一个命令。 |

## 行为

- 默认匿名；署名模式按 QQ 用户保存。原名会在投递时读取当前群昵称或 QQ 昵称，旧瓶子不受后续改名影响。
- AI 模式下，投瓶内容和署名通过 AI 审核后才会公开；人工模式下，新投瓶会保存完整草稿并进入待审核列表，通过后才会公开。
- 人工模式只改变投瓶流程；评论、别名和原名署名仍使用 AI 审核。
- 每次 AI 审核完成后，插件日志会记录输入、输出和总 Token 数量。
- 每次 AI 审核都会写入 SQLite 的 `bottle_moderation_records` 表，包括时间、投稿内容 JSON、审核结果或错误、Token 用量、调用是否成功及内容是否通过。
- R18 审核包含性暗示倾向、敏感部位聚焦或触摸等内容，卡通、动物和表情包采用相同标准。
- AI 审核失败或服务不可用时不会绕过审核，相关投瓶记录会进入待审核列表供人工处理。
- 数据存储在 SQLite 中，旧版数据库会自动迁移。
- 漂流瓶管理权限列表存储在同一个 SQLite 数据库中；群主和群管理员无需加入列表即可删除瓶子，但人工审核仍需主人或列表授权。
- 重复捡取设置按 QQ 用户存储在 SQLite 中，只影响该用户执行 `捡瓶子` 时的行为。
- 捡取后删除只移除瓶子内容，评论索引会保留；使用管理删除命令会同时删除评论。
- 包含图片、视频、表情、动态表情或合并转发的瓶子会先单独发送来源和 ID，再发送瓶子内容。

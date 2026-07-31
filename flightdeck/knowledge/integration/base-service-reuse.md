# Fraq 基础服务复用评估 checklist

SUMMARY: 始终在扩展本插件的持久化、WebUI 鉴权、随机选择或消息读取前核对 Fraq 官方基础服务；当前优先评估 Kysely 与 WebUI Gateway，Random 仅属窄幅重叠。
READ WHEN: before any persistence, WebUI authentication, random selection, or message-history integration change

---

## 2026-08-01 市场基线

`fraq.dev/plugins` 的“基础服务”对应 registry 的 `infrastructure` 分类。当前本插件已经：

- 通过 `AiService` 使用 `@fraqjs/plugin-ai`；
- 通过 `HonoService` 使用 `@fraqjs/plugin-hono`；
- 在测试中使用 `@fraqjs/mock` 提供的 Milky mock 工具。

## 确认存在的重叠

### `@fraqjs/plugin-kysely`：高重叠

本插件的 `BottleStore` 直接持有 `node:sqlite` 的 `DatabaseSync`，自行创建表、执行增量列迁移、管理事务和关闭连接。Kysely 基础服务同样基于 `node:sqlite`，额外提供共享数据库、类型安全查询、迁移注册、生命周期管理和自动 `VACUUM`。

迁移不是机械替换：需要保留现有 `storagePath` 和已有数据库文件的升级路径，并把同步 store API、手写 SQL 与已发布迁移改为 Kysely schema/migrations。先写迁移兼容设计，再决定是否增加必需基础服务依赖。

### `@fraqjs/plugin-webui-gateway`：基础设施高重叠，身份模型不等价

本插件在 `HonoService` 上自行实现 SPA 静态文件发布、fallback、登录入口、`HttpOnly` Cookie、内存会话和逐路由鉴权。WebUI Gateway 已提供统一 `/webui/<id>/` 挂载、静态资源、登录入口、签名 Cookie 和自动保护的 API 路由。

但 Gateway 当前使用宿主级单一 `accessToken`；本插件使用 QQ 账号、密码哈希、主人审批、主人/管理员角色、改密和账号管理。除非接受统一令牌并移除这些产品能力，或 Gateway 增加可扩展身份提供器，否则不能直接替换本插件的认证域。可以优先复用其挂载与路由保护思路，但不要假设认证语义等价。

### `@fraqjs/plugin-random`：窄幅重叠

随机捡瓶目前仅用一次 `Math.random()` 计算数据库偏移。`RandomService` 能提供带种子的 PCG32、pick/shuffle 和可导入状态，适合可复现测试或统一宿主随机源；为了单次均匀抽取增加必需依赖收益有限。密码、盐、会话 token 和 UUID 必须继续使用 `node:crypto`，不能换成伪随机服务。

## 不构成可替换重复

- `@fraqjs/plugin-conversation` 面向短时、同一会话的多轮交互；WebUI 注册审批是持久化、跨用户、可延迟处理的工作流。
- `@fraqjs/plugin-message-store` 保存原始 Milky 消息并覆盖 `get_message`/`get_history_messages`；瓶子、评论、审核、账号和设置是本插件领域数据。宿主可安装它提高引用消息的本地可用性，但它不能代替 `BottleStore`。
- `@fraqjs/plugin-milky-server`、`@fraqjs/plugin-milky-webhook` 和 `fraq-plugin-onebot-server` 是协议接入/代理层，本插件没有实现对应服务端或传输层。
- `@fraqjs/plugin-takumi` 提供服务端图片渲染；本插件只转发或预览已有媒体。
- `@fraqjs/plugin-ai` 的消息 XML 转换与本插件针对瓶子审核构造的多模态模型输入目标不同；当前已正确复用模型注册服务。

## 决策顺序

1. 先决定是否接受 Kysely 成为运行时必需依赖，并设计已有 SQLite 文件的无损迁移。
2. 单独决定 WebUI 身份模型：保留 QQ 账号/审批/角色，或切换到宿主统一 access token。
3. 只有需要可复现随机序列或更多随机操作时，再引入 RandomService。

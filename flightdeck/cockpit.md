# Cockpit — fraq-plugin-drift-bottle

Focus: Kysely 持久层迁移已完成，等待真实 Fraq 宿主旧数据库回归与后续发布。

## In flight

- `manual-bottle-moderation` — 已随 v0.3.16 发布，AI/人工投瓶审核可即时切换，等待宿主回归。
- `ai-schema-response` — 已随 v0.3.15 发布，仍待真实网关内容审核回归。
- `bottle-list-order` — 已随 v0.3.17 发布，评论展开、评论头像和图片按需预览等待宿主回归。

## Next

- 在宿主配置 `fraqjs/kysely.sqliteUrl` 指向现有漂流瓶数据库，验证 schema 原地迁移和完整业务流程。
- 在宿主完成投瓶入队、机器人审核命令和人工通过回归。
- 完成 AI 结构化响应修复的真实网关回归。
- 在真实 Fraq 宿主中回归全部瓶子评论展开；后续按需增加评论管理操作。

## Open questions

- WebUI 是否继续保留 QQ 账号、主人审批和角色权限，还是切换到 `@fraqjs/plugin-webui-gateway` 的宿主级统一 access token。

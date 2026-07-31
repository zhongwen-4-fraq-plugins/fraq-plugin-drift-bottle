# Cockpit — fraq-plugin-drift-bottle

Focus: v0.3.17 已发布图片按需预览、评论头像与待审核过滤，等待真实 Fraq 宿主回归。

## In flight

- `manual-bottle-moderation` — 已随 v0.3.16 发布，AI/人工投瓶审核可即时切换，等待宿主回归。
- `ai-schema-response` — 已随 v0.3.15 发布，仍待真实网关内容审核回归。
- `bottle-list-order` — 已随 v0.3.17 发布，评论展开、评论头像和图片按需预览等待宿主回归。

## Next

- 在宿主完成投瓶入队、机器人审核命令和人工通过回归。
- 完成 AI 结构化响应修复的真实网关回归。
- 在真实 Fraq 宿主中回归全部瓶子评论展开；后续按需增加评论管理操作。

## Open questions

- 是否将自建 `node:sqlite` 持久层迁移到 `@fraqjs/plugin-kysely`，以及如何无损兼容现有 `storagePath` 数据库。
- WebUI 是否继续保留 QQ 账号、主人审批和角色权限，还是切换到 `@fraqjs/plugin-webui-gateway` 的宿主级统一 access token。

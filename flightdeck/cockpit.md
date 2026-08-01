# Cockpit — fraq-plugin-drift-bottle

Focus: WebUI 评论正文已与评论者名字对齐，等待下一版本发布与真实宿主回归。

## In flight

- `manual-bottle-moderation` — 已随 v0.3.16 发布，AI/人工投瓶审核可即时切换，等待宿主回归。
- `ai-schema-response` — 已随 v0.3.15 发布，仍待真实网关内容审核回归。
- `bottle-list-order` — 评论正文对齐修复等待发布；评论展开、头像和图片预览已发布并等待宿主回归。

## Next

- 发布评论正文与评论者名字对齐修复，并在桌面与移动端回归真实评论。
- 在宿主完成投瓶入队、机器人审核命令和人工通过回归。
- 完成 AI 结构化响应修复的真实网关回归。
- 在真实 Fraq 宿主中回归全部瓶子评论展开；后续按需增加评论管理操作。

## Open questions

- WebUI 是否继续保留 QQ 账号、主人审批和角色权限，还是切换到 `@fraqjs/plugin-webui-gateway` 的宿主级统一 access token。

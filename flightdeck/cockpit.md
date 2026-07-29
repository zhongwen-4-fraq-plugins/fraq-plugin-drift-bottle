# Cockpit — fraq-plugin-drift-bottle

Focus: 投瓶人工审核模式及机器人通过/拒绝命令已完成并通过本地验证，等待发布与宿主回归。

## In flight

- `manual-bottle-moderation` — AI/人工投瓶审核可即时切换，人工记录可在 WebUI 或机器人命令中通过、拒绝，等待发布与宿主回归。
- `ai-schema-response` — 已随 v0.3.15 发布，仍待真实网关内容审核回归。
- `bottle-list-order` — 工作目录存在但缺少 `index.md`，需要决定恢复或清理。

## Next

- 发布投瓶人工审核模式并更新宿主，完成投瓶入队和人工通过回归。
- 完成 AI 结构化响应修复的真实网关回归。
- 为全部瓶子列表增加详情、评论查看和管理操作。

## Open questions

- `bottle-list-order` 是否仍需恢复为有效工作包？

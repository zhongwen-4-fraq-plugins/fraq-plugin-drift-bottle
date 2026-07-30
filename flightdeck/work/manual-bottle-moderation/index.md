# Index — manual-bottle-moderation

## State

投瓶人工审核模式及机器人通过/拒绝命令已实现并通过完整本地验证，等待发布与宿主验证；AI 模式及 AI 异常/拒绝后的人工兜底保持兼容。

## Next

- 发布新版本并更新 `D:\bot\fraq-plugins\my-fraq-app`。
- 在宿主中切换一次审核方式，确认人工投瓶进入待审核列表且不会调用 AI。

## Read now

- `flightdeck/knowledge/moderation/pending-record-publication-context.md`
- `flightdeck/knowledge/integration/fraq-cli-plugin-loading.md`

## Read if

- `flightdeck/knowledge/integration/fraq-hono-webui.md` — 如果需要改变 WebUI 路由或 Hono 装配方式。

## Progress

Done:

- 确认现有人工审核只覆盖 AI 拒绝或执行失败记录。
- 确认人工模式仅改变投瓶流程；评论和署名继续使用现有 AI 审核。
- 新增 `moderationMode: 'ai' | 'manual'` 配置、SQLite 持久化及设置页即时切换。
- 人工模式保存完整投瓶草稿，命令回复待审核，WebUI 显示“待人工审核”。
- 人工通过沿用现有事务原子发布瓶子，拒绝仍要求填写理由。
- 补充公开 API、命令、Fraq CLI 配置、列表、主页、设置和 Hono 路由测试。
- 更新 README 配置表、审核记录和行为说明。
- 新增 `漂流瓶审核 通过 <审核记录ID>` 与 `漂流瓶审核 拒绝 <审核记录ID> <拒绝理由>`。
- 主人和数据库管理权限用户可以执行审核命令；群管理身份不会自动获得审核权。
- 审核命令复用 WebUI 的原子发布、拒绝归档、旧记录保护和重复处理结果。
- 更新帮助与权限文案，明确数据库授权用户可以删除和审核漂流瓶。
- 主页操作记录将人工投瓶记录显示为“提交漂流瓶审核”，并附带提交者 QQ；审批结论继续单独记录。

Current:

- 等待发布与宿主回归。

Verified:

- `pnpm check`
- `pnpm test`（42 项通过）
- `pnpm build`

## Open questions

无。

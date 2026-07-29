# Index — bottle-list-order

## State

“全部瓶子”评论展开已随 v0.3.16 发布并通过本地验证，等待宿主回归。

## Next

- 发布后在 Fraq 宿主中确认真实评论数据、桌面表格和移动端展开效果。
- 后续如需评论管理，在现有详情接口上增加权限受控的删除操作。

## Read now

- `flightdeck/knowledge/webui/nested-route-urls.md`
- `flightdeck/knowledge/integration/fraq-hono-webui.md`
- `flightdeck/knowledge/webui/responsive-list-detail-expansion.md`

## Read if

- `flightdeck/knowledge/webui/icon-only-actions.md` — 如果展开入口最终使用纯图标按钮。

## Progress

Done:

- 确认原空工作目录继续用于全部瓶子列表增强。
- 列表摘要增加评论数量，有评论时显示展开入口。
- 增加受认证的按瓶子读取评论接口，并正确返回 401 与 404。
- 桌面和移动端共用展开状态及按瓶子缓存，首次展开时按需加载。
- 评论区支持加载、失败重试、空结果、总数提示和减少动态效果偏好。
- 评论正文相对元信息向右缩进 `3em`。

Current:

- 等待发布与真实 Fraq 宿主回归。

Verified:

- `pnpm check`
- `pnpm test`（42 项全部通过）
- `pnpm build`
- `git diff --check`

## Open questions

无。

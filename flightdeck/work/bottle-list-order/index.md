# Index — bottle-list-order

## State

“全部瓶子”评论正文已改为与评论者名字共享文本起始轴，并随 v0.3.19 发布；评论展开、头像和图片按需预览也已发布。

## Next

- 在 Fraq 宿主确认评论正文对齐、真实评论数据、桌面表格和移动端展开效果。
- 后续如需评论管理，在现有详情接口上增加权限受控的删除操作。

## Read now

- `flightdeck/knowledge/webui/nested-route-urls.md`
- `flightdeck/knowledge/integration/fraq-hono-webui.md`
- `flightdeck/knowledge/webui/responsive-list-detail-expansion.md`
- `flightdeck/knowledge/webui/protected-media-preview.md`

## Read if

- `flightdeck/knowledge/webui/icon-only-actions.md` — 如果展开入口最终使用纯图标按钮。

## Progress

Done:

- 确认原空工作目录继续用于全部瓶子列表增强。
- 列表摘要增加评论数量，有评论时显示展开入口。
- 增加受认证的按瓶子读取评论接口，并正确返回 401 与 404。
- 桌面和移动端共用展开状态及按瓶子缓存，首次展开时按需加载。
- 评论区支持加载、失败重试、空结果、总数提示和减少动态效果偏好。
- 评论者名字前显示 QQ 头像；头像加载失败时回退到用户图标。
- 评论条目使用固定头像列和自适应内容列，名字、QQ/时间与多行正文保持同一文本起始轴。
- 全部瓶子列表将图片显示为“[点击查看图片]”，点击后通过认证接口刷新 QQ 资源地址并在响应式对话框中预览。

Current:

- 评论正文对齐修复已随 v0.3.19 发布；全部功能等待真实 Fraq 宿主回归。

Verified:

- `pnpm check`
- `pnpm test`（42 项全部通过）
- `pnpm build`
- `git diff --check`
- Impeccable layout 双重评估与机械重扫（0 项）。
- Chrome 900px 桌面及 312px 移动组件截图验证，无溢出。

## Open questions

无。

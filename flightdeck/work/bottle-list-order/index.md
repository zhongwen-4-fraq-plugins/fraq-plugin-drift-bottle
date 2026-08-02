# Index — bottle-list-order

## State

WebUI 的普通 QQ 表情消息已通过 QFace 索引显示真实静态表情，并保留安全文字回退；本地验证完成，等待发布与真实宿主回归。

## Next

- 发布并在真实 Fraq 宿主确认普通 QQ 表情、文字回退、桌面表格和移动列表效果。
- 登录 Fraq 宿主继续确认评论正文对齐、真实评论数据和评论展开效果。
- 后续如需评论管理，在现有详情接口上增加权限受控的删除操作。

## Read now

- `flightdeck/knowledge/webui/nested-route-urls.md`
- `flightdeck/knowledge/integration/fraq-hono-webui.md`
- `flightdeck/knowledge/webui/responsive-list-detail-expansion.md`
- `flightdeck/knowledge/webui/protected-media-preview.md`
- `flightdeck/knowledge/webui/qface-asset-rendering.md`

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
- 普通 QQ 表情片段保留字符串 `face_id`，并通过 QFace `_index.json` 的 `assets` 显示对应静态 PNG。
- QFace 索引请求在前端全局复用；目录越界、无资源、索引或图片失败时回退 `[表情：ID]`。
- 表情图片使用 24px 固定内联尺寸、描述性替代文本、延迟解码与无 referrer 请求。

Current:

- QFace 表情显示等待发布与真实宿主回归；既有列表功能继续等待登录后视觉回归。

Verified:

- `pnpm check`
- `pnpm test`（42 项全部通过）
- `pnpm build`
- `git diff --check`
- Impeccable layout 双重评估与机械重扫（0 项）。
- Chrome 900px 桌面及 312px 移动组件截图验证，无溢出。
- GitHub Publish 工作流、GitHub Release 与 npm `0.3.19` 发布成功。
- 真实 Fraq CLI 0.7 宿主安装 `0.3.19`、启动 Kysely/Hono/WebUI 并返回页面与会话接口 `200`。
- 验证结束后完整 Fraq 进程链已停止，`4649` 端口已释放。
- `pnpm check`、`pnpm test`（45 项）与 `pnpm build` 通过。
- Impeccable 检测 0 项；真实 QFace 索引可解析 ID 14“微笑”和 ID 5“流泪”。
- Chrome 610px 桌面内容与 288px 窄栏预览通过；窄栏 `clientWidth` 与 `scrollWidth` 均为 288px。

## Open questions

无。

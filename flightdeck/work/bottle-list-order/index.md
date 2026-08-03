# Index — bottle-list-order

## State

WebUI 合并转发默认显示前四条消息，点击后显示全部并可收起；已完成本地构建、测试及桌面/窄屏视觉验证，待发布和真实宿主回归。

## Next

- 登录真实 Fraq 宿主确认普通 QQ 表情、文字回退、桌面表格和移动列表效果。
- 登录真实 Fraq 宿主确认合并转发 Markdown、嵌套转发和无明细摘要效果。
- 发布后在真实 Fraq 宿主确认四条预览、展开全部、收起以及断点切换状态。
- 登录 Fraq 宿主继续确认评论正文对齐、真实评论数据和评论展开效果。
- 后续如需评论管理，在现有详情接口上增加权限受控的删除操作。

## Read now

- `flightdeck/knowledge/webui/nested-route-urls.md`
- `flightdeck/knowledge/integration/fraq-hono-webui.md`
- `flightdeck/knowledge/webui/responsive-list-detail-expansion.md`
- `flightdeck/knowledge/webui/protected-media-preview.md`
- `flightdeck/knowledge/webui/qface-asset-rendering.md`
- `flightdeck/knowledge/webui/safe-forward-markdown-rendering.md`

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
- 合并转发标题、发送者和正文由结构化消息生成 Markdown，并支持两层嵌套转发。
- Markdown 渲染禁用原始 HTML、限制链接协议，并将外部图片替换为文字占位。
- GFM 表格和代码块使用局部横向滚动，普通正文在窄栏中保持换行；无消息明细时保留原摘要。
- 合并转发从结构化顶层消息生成前四条预览、完整 Markdown 与总条数，避免按 Markdown 分隔线误切嵌套内容。
- 超过四条时显示“查看全部”入口，展开后可收起；桌面与移动视图共享每个瓶子消息段的展开状态。

Current:

- 合并转发四条预览已完成本地实现与验证；等待发布并登录真实宿主回归。

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
- `pnpm check`、`pnpm test`（47 项）与 `pnpm build` 通过。
- Chrome 桌面默认预览显示四条及完整总数；展开后的 288px 内容宽度 `clientWidth` 与 `scrollWidth` 均为 288px。
- Impeccable 布局与排版分别完成隔离人工评估和机械扫描（最终均 0 项）；修正按钮垂直居中、Markdown 标题字重与正文代码字号后重新截图通过。
- 视觉测试进程链已完整停止，`5183` 端口已释放。
- `pnpm check`、`pnpm test`（46 项）与 `pnpm build` 通过。
- Impeccable 检测 0 项；Chrome 900px 桌面及 288px 内容宽度组件截图通过。
- 原始 HTML 未注入 DOM，Markdown 外部图片只生成文字占位；视觉测试服务已停止且 `5183` 端口释放。
- GitHub Publish 工作流、GitHub Release 与 npm `0.3.21` 发布成功。
- 真实 Fraq CLI 0.7 宿主安装 `0.3.21` 并启动 Kysely/Hono/WebUI；页面、会话和前端资源均返回 `200`。
- 发布 bundle 包含 `0.3.21` 版本号、合并转发表格语义和 Markdown 样式；验证后完整进程链已停止，`4649` 端口释放。
- `pnpm check`、`pnpm test`（45 项）与 `pnpm build` 通过。
- Impeccable 检测 0 项；真实 QFace 索引可解析 ID 14“微笑”和 ID 5“流泪”。
- Chrome 610px 桌面内容与 288px 窄栏预览通过；窄栏 `clientWidth` 与 `scrollWidth` 均为 288px。
- GitHub Publish 工作流、GitHub Release 与 npm `0.3.20` 发布成功。
- 真实 Fraq CLI 0.7 宿主安装 `0.3.20` 并启动成功；WebUI 页面与会话接口返回 `200`。
- 发布 bundle 包含版本号、QFace 索引路径和文字回退；QFace 索引与 ID 14 PNG 均返回 `200`。
- 验证结束后完整 Fraq 进程链已停止，`4649` 端口已释放。

## Open questions

无。

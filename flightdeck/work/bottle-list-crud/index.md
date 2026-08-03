# Index - bottle-list-crud

## State

WebUI 全部瓶子列表的新增、修改和删除能力已随 v0.3.22 发布；未发布改动已把正文编辑扩展到混合消息中的全部文字段，并保持非文字消息段不变。

## Next

- 登录真实 Fraq 宿主，用主人和管理员账号分别验证新增、修改、删除。
- 用普通 WebUI 账号确认操作入口隐藏，直接调用写接口返回 403。
- 登录真实宿主验证图文和多文字段瓶子可分别修改全部文字，图片、视频、表情和合并转发仍保持不变。
- 用户方便时重启原有 `4649` 宿主，使既有运行实例加载磁盘上的 `0.3.22`。

## Read now

- `flightdeck/knowledge/webui/authentication.md`
- `flightdeck/knowledge/webui/icon-only-actions.md`
- `flightdeck/knowledge/integration/fraq-hono-webui.md`
- `flightdeck/knowledge/webui/responsive-list-detail-expansion.md`
- `flightdeck/knowledge/webui/bottle-crud.md`

## Read if

- `flightdeck/knowledge/webui/protected-media-preview.md` - 修改列表媒体展示或图片访问时。

## Progress

Current:

- 多文字段内容编辑与服务端索引校验已实现并通过本地验证，等待发布和真实宿主登录回归。

Done:

- 新增 BottleStore 事务更新及 DriftBottleApi 更新方法，管理操作记录新增 `bottle-updated`。
- 新增受主人/管理员权限保护的 POST、PUT、DELETE 瓶子接口及完整输入校验。
- 新增只创建文本瓶子；所有瓶子可修改发送者、署名和来源，纯文本瓶子还可修改正文。
- WebUI 标题区增加新增按钮，每行增加修改和删除图标按钮，使用列表级内联表单和删除确认。
- 桌面表格和移动列表共享编辑状态；图标操作具备可访问名称、焦点提示和粗指针 44px 目标。
- 列表返回全部文字段的原始索引，编辑器为每段文字提供独立输入；服务端要求索引集合完整一致并保留所有非文字段。

Verified:

- `pnpm check`
- `pnpm test`：48 项全部通过。
- `pnpm build`
- 多文字段内容编辑与 AI 操作明细改动后再次通过 `pnpm check`、48 项测试和 `pnpm build`。
- Impeccable 检测修改后的 BottleLists、Dashboard 和样式文件为 0 项。
- `git diff --check`
- Impeccable 检测 0 项。
- Chrome 1280x900 桌面与 390x844 移动截图通过；移动视图 `documentWidth` 等于 390px，无横向溢出。
- 临时模拟服务、Chrome 进程及 5197/9223 端口已清理。
- GitHub Publish 工作流、GitHub Release 和 npm `0.3.22` 发布成功，npm `latest` 指向 `0.3.22`。
- `D:\bot\fraq-plugins\my-fraq-app` 的 `versions.yml`、生成清单和已安装包均更新为 `0.3.22`。
- 因用户原有 `4649` 实例正在运行，使用临时 `4650` 与独立 SQLite 启动 `0.3.22`；WebUI 页面、会话和构建资源均返回 `200`，未登录新增返回 `401`。
- 验证进程链、`4650` 端口和独立验证数据库均已清理；原有 PID `38084` 保持运行，正式配置和数据库未改动。

## Open questions

无。

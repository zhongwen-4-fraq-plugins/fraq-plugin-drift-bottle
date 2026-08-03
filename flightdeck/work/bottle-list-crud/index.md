# Index - bottle-list-crud

## State

WebUI 全部瓶子列表的新增、修改和删除能力已完成本地实现与验证，等待真实 Fraq 宿主回归。

## Next

- 登录真实 Fraq 宿主，用主人和管理员账号分别验证新增、修改、删除。
- 用普通 WebUI 账号确认操作入口隐藏，直接调用写接口返回 403。
- 验证含图片、视频、表情和合并转发的瓶子只能修改来源信息，原消息段保持不变。

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

Done:

- 新增 BottleStore 事务更新及 DriftBottleApi 更新方法，管理操作记录新增 `bottle-updated`。
- 新增受主人/管理员权限保护的 POST、PUT、DELETE 瓶子接口及完整输入校验。
- 新增只创建文本瓶子；所有瓶子可修改发送者、署名和来源，纯文本瓶子还可修改正文。
- WebUI 标题区增加新增按钮，每行增加修改和删除图标按钮，使用列表级内联表单和删除确认。
- 桌面表格和移动列表共享编辑状态；图标操作具备可访问名称、焦点提示和粗指针 44px 目标。

Verified:

- `pnpm check`
- `pnpm test`：48 项全部通过。
- `pnpm build`
- `git diff --check`
- Impeccable 检测 0 项。
- Chrome 1280x900 桌面与 390x844 移动截图通过；移动视图 `documentWidth` 等于 390px，无横向溢出。
- 临时模拟服务、Chrome 进程及 5197/9223 端口已清理。

## Open questions

无。

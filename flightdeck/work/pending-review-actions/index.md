# Index — pending-review-actions

## State

内容类型标签与设计简报已确认；正在完成 Impeccable 视觉方向门槛。

## Next

- 用户确认颜色、氛围与参考方向。
- 确认 palette artifact 与视觉 mock。
- 完成视觉方向门槛后实现操作栏、状态模型与写接口。
- 测试并验证完整人工审核流程。

## Read now

- `webui/src/BottleLists.tsx`
- `webui/src/styles.css`
- `src/webui/lists.ts`
- `src/webui/routes.ts`
- `test/webui-lists.test.ts`
- `flightdeck/knowledge/moderation/pending-record-publication-context.md`
- `flightdeck/knowledge/webui/icon-only-actions.md`

## Read if

- `flightdeck/knowledge/webui/nested-route-urls.md` — 如果新增 WebUI API 请求。
- `flightdeck/knowledge/webui/icon-only-actions.md` — 如果操作栏使用纯图标控件。

## Progress

Done:
- 确认当前桌面表格和移动信息行均显示内容类型纯文字。
- 确认当前 API 只有待审核列表读取接口，没有人工处理写接口。
- 确认审核记录缺少投瓶者、来源会话与署名，旧记录不能直接人工通过并投放。
- 桌面与移动列表的内容类型均改为可换行的语义化标签组。
- 用户确认操作为“通过并投放 / 拒绝并归档”。
- 用户确认插件主人和管理员均可执行人工审核。
- 用户要求操作栏使用勾和叉图标；叉号操作必须填写拒绝理由。
- 用户确认修订后的紧凑设计简报。

Current:
- Impeccable Codex Step A：视觉方向问题。

## Open questions

无。

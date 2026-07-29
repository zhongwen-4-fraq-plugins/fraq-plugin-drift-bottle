# Index — pending-review-actions

## State

已完成现状检查，等待用户确认操作语义与权限范围。

## Next

- 确认操作是“标记处理/删除记录”，还是扩展数据模型后支持“通过并投放/拒绝”。
- 确认哪些 WebUI 账号可以执行写操作。
- 用户确认设计简报后实现、测试并验证。

## Read now

- `webui/src/BottleLists.tsx`
- `webui/src/styles.css`
- `src/webui/lists.ts`
- `src/webui/routes.ts`
- `test/webui-lists.test.ts`
- `flightdeck/knowledge/moderation/pending-record-publication-context.md`

## Read if

- `flightdeck/knowledge/webui/nested-route-urls.md` — 如果新增 WebUI API 请求。
- `flightdeck/knowledge/webui/icon-only-actions.md` — 如果操作栏使用纯图标控件。

## Progress

Done:
- 确认当前桌面表格和移动信息行均显示内容类型纯文字。
- 确认当前 API 只有待审核列表读取接口，没有人工处理写接口。
- 确认审核记录缺少投瓶者、来源会话与署名，旧记录不能直接人工通过并投放。

Current:
- Impeccable shape 发现阶段，等待用户回答操作与权限问题。

## Open questions

- 人工操作是仅退出待审核队列，还是需要把被拒内容重新创建为漂流瓶。

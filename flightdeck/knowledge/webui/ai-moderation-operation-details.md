# AI moderation operation detail checklist

SUMMARY: 始终让 AI 审核活动显示审核对象名称、输入 Token、输出 Token 和总 Token；缺失用量明确标为未知，明细不能被桌面布局省略。
READ WHEN: before any AI moderation operation record, token usage, or dashboard activity detail change

---

- AI 审核通过、未通过和执行失败使用同一套明细字段，不能只在成功路径显示 Token。
- “名称”来自审核目标类型，例如瓶子内容、评论内容或署名设置；旧记录缺少目标时显示“历史记录”。
- 输入、输出和总 Token 分别读取审核记录的持久化字段，不能只从总 Token 反推。
- Provider 未返回某项用量时显示“未知”，不要用 `0` 冒充真实数据。
- 活动列表允许明细换行和长词断行，确保桌面和移动端都能读到完整字段。

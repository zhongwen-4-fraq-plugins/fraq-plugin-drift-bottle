# ⚠ 待审核记录缺少重新投放漂流瓶所需上下文

SUMMARY: 当前待审核记录只持久化内容与审核结果，不含投瓶者、来源会话和署名；不能仅靠新增“通过”按钮把旧记录正确创建为漂流瓶。
READ WHEN: before adding any manual approve, publish, or requeue action to the pending moderation list

---

- 漂流瓶创建需要 `senderId`、`source.scene`、`source.peerId`、内容以及署名解析结果；当前 `bottle_moderation_records` 只有内容、审核过程、Token、成功和通过状态。
- “标记已处理”可以只扩展审核记录状态，但“通过并投放”必须先为新的审核请求持久化完整创建上下文。
- 历史待审核记录无法可靠补出缺失上下文；界面必须禁用其投放动作或只允许归档、删除。
- 人工操作还需要记录处理人、处理时间和处理结论，避免通过修改原始 AI 结果来伪造审核历史。

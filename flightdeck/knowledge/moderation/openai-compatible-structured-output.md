# ⚠ OpenAI-compatible 默认不会发送结构化输出 Schema

SUMMARY: `@ai-sdk/openai-compatible` 的 `supportsStructuredOutputs` 默认为 false；`Output.object` 此时只发送 `json_object` 而不发送 JSON Schema，模型返回合法 JSON 仍可能因字段或类型不匹配而触发 `AI_NoObjectGeneratedError`。
READ WHEN: when moderation reports "No object generated: response did not match schema" with an OpenAI-compatible provider

---

- AI SDK 对“无法解析 JSON”和“JSON 未通过 Schema”使用不同错误消息；`response did not match schema` 说明 JSON 解析已经成功，失败发生在类型校验。
- `@ai-sdk/openai-compatible` 只有在 provider options 明确设置 `supportsStructuredOutputs: true` 时才发送 `response_format.type = json_schema`；默认只发送 `json_object`，同时产生一条 unsupported warning。
- 只有网关和目标模型确实支持 OpenAI `json_schema` 时才能打开该选项；未经确认直接打开可能把校验错误变成 HTTP 400。
- 消费插件应在提示词中明确列出字段名、类型和允许值，并在失败时保留 `NoObjectGeneratedError` 的 `cause`、`text`、`usage`、`finishReason` 或经过脱敏的诊断摘要。
- Schema 失败必须保持 fail-closed；可以针对该错误进行一次受限修复或重试，但不能把未经校验的模型输出当作审核通过。

# Index — ai-schema-response

## State

根因已确认，尚未实施修复。

## Next

- 先让审核失败记录保留 Schema 校验原因、模型响应摘要、usage 与 provider warning。
- 在提示词中明确审核 JSON 的三个字段、类型和允许值，并为 Schema 失败增加一次受限修复或重试。
- 仅在确认 Akile 网关与目标模型支持 `json_schema` 后，考虑配置 `supportsStructuredOutputs: true`。
- 将宿主中明文写入的 API Key 轮换，并改用环境变量引用。

## Read now

- `src/processing/moderation.ts`
- `test/moderation.test.ts`
- `src/processing/moderation-records.ts`
- `flightdeck/knowledge/integration/fraq-ai-model-registry.md`
- `flightdeck/knowledge/moderation/openai-compatible-structured-output.md`

## Read if

- `flightdeck/knowledge/integration/fraq-ai-model-registry.md` — 如果问题涉及模型、provider 或 AI SDK 配置变化。
- `flightdeck/knowledge/moderation/ai-sdk-media-download.md` — 如果日志同时出现媒体下载失败。

## Progress

Done:
- 确认 AI SDK 已成功解析 JSON，失败发生在 Zod Schema 校验。
- 确认宿主使用 `@ai-sdk/openai-compatible`，且未启用 `supportsStructuredOutputs`。
- 确认 SDK 在该配置下只发送 `json_object`，不会把审核 Schema 发给网关。
- 确认现有数据库记录丢弃了原始响应、校验 cause、usage 与 finish reason。

Current:
- 等待用户确认是否实施修复。

## Open questions

- Akile 网关的 `gpt-5.6-sol` 是否支持 OpenAI `json_schema` 响应格式。

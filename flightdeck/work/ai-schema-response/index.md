# Index — ai-schema-response

## State

修复已实现并通过本地完整验证，等待发布与真实网关回归。

## Next

- 发布并更新 Fraq 宿主，使用真实网关复核一次结构错误和一次正常审核。
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
- 等待发布与真实网关回归。

Implemented:
- 提示词明确限定 `approved`、`categories`、`reason` 三个字段、JSON 类型与允许值。
- 仅对 `NoObjectGeneratedError` 进行一次受限重试，第二次仍失败时保持 fail-closed。
- 失败记录保存校验 cause、最多 1000 字符的响应摘要、累计 Token、finish reason、provider warning 与尝试次数。
- 成功重试会累计两次 Token；普通 provider 错误不会重试。

Verified:
- `pnpm check` 成功。
- `pnpm test` 通过 36 项测试，覆盖首次结构失败后成功及两次失败的诊断持久化。
- `pnpm build` 成功。

## Open questions

- Akile 网关的 `gpt-5.6-sol` 是否支持 OpenAI `json_schema` 响应格式。

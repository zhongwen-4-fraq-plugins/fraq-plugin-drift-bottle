# Index — ai-schema-response

## State

结构校验诊断已发布；v0.3.19 真实宿主在模型调用前下载 QQ 临时媒体时命中瞬时 `AI_DownloadError`，当前实现未按既有约束重试。

## Next

- 仅针对 `AI_DownloadError` 重试一次完整 `generateText` 调用，继续保持审核关闭失败。
- 覆盖首次下载失败后成功、连续下载失败后拒绝的测试，再发布并用真实 QQ 媒体回归。
- 使用真实网关继续复核一次结构错误和一次正常审核。
- 仅在确认 Akile 网关与目标模型支持 `json_schema` 后，考虑配置 `supportsStructuredOutputs: true`。
- 将宿主中明文写入的 API Key 轮换，并改用环境变量引用。

## Read now

- `src/processing/moderation.ts`
- `test/moderation.test.ts`
- `src/processing/moderation-records.ts`
- `flightdeck/knowledge/integration/fraq-ai-model-registry.md`
- `flightdeck/knowledge/moderation/openai-compatible-structured-output.md`
- `flightdeck/knowledge/moderation/ai-sdk-media-download.md`

## Read if

- `flightdeck/knowledge/integration/fraq-ai-model-registry.md` — 如果问题涉及模型、provider 或 AI SDK 配置变化。

## Progress

Done:
- 确认 AI SDK 已成功解析 JSON，失败发生在 Zod Schema 校验。
- 确认宿主使用 `@ai-sdk/openai-compatible`，且未启用 `supportsStructuredOutputs`。
- 确认 SDK 在该配置下只发送 `json_object`，不会把审核 Schema 发给网关。
- 确认现有数据库记录丢弃了原始响应、校验 cause、usage 与 finish reason。
- v0.3.19 真实宿主失败记录确认为 `AI_DownloadError`，底层为 QQ 临时媒体 URL 的 `TypeError: fetch failed`；未产生 Token，尝试次数为 1。
- 对同一临时 URL 执行 1 字节范围请求返回 `206`，确认资源随后可访问，符合瞬时下载故障特征。
- 确认当前代码只对 `NoObjectGeneratedError` 重试，尚未实现知识约束要求的媒体下载受限重试。

Current:
- 待实现 `AI_DownloadError` 单次受限重试并回归真实 QQ 媒体。

Implemented:
- 提示词明确限定 `approved`、`categories`、`reason` 三个字段、JSON 类型与允许值。
- 仅对 `NoObjectGeneratedError` 进行一次受限重试，第二次仍失败时保持 fail-closed。
- 失败记录保存校验 cause、最多 1000 字符的响应摘要、累计 Token、finish reason、provider warning 与尝试次数。
- 成功重试会累计两次 Token；普通 provider 错误不会重试。

Verified:
- `pnpm check` 成功。
- `pnpm test` 通过 36 项测试，覆盖首次结构失败后成功及两次失败的诊断持久化。
- `pnpm build` 成功。
- SQLite 最新失败记录时间与宿主 `2026/08/01 08:51:37` 堆栈一致。
- 同一 QQ 临时媒体 URL 的范围请求返回 `206 Partial Content`。
- 诊断结束后完整 Fraq 进程链已停止，`4649` 端口已释放。

## Open questions

- Akile 网关的 `gpt-5.6-sol` 是否支持 OpenAI `json_schema` 响应格式。

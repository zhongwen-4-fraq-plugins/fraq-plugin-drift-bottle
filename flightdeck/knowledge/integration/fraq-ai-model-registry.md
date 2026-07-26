# ⚠ Fraq AI 模型名必须匹配 provider 注册键

SUMMARY: `defaultModel` 和消费插件的模型选项必须严格引用 `providers` 中声明的 `提供商名称/模型名称`，第三方 Chat Completions 网关使用 `@ai-sdk/openai-compatible`。
READ WHEN: when Fraq AI throws "Model not found" or a provider, model, defaultModel, baseURL, or AI SDK package changes

---

Fraq AI 插件会把每个 `providers.<name>.models[]` 注册为 `${name}/${modelId}`。`defaultModel`、别名目标和消费插件传给
`ctx.ai.model()` 的名称都必须命中这个完整键；声明 `models: [gpt-5.6-sol]` 后再引用
`openai/gpt-4o-mini` 会在插件应用阶段直接抛出 `Model not found`。

依据 [Fraq AI 插件文档](https://fraq.dev/docs/plugins/ai)：

- OpenAI `/v1/responses` 风格接口使用 `@ai-sdk/openai`。
- 第三方 `/v1/chat/completions` 风格接口使用 `@ai-sdk/openai-compatible`。
- `baseURL` 通常以 `/v1` 结尾，SDK 包还必须出现在 `additionalDependencies`。
- API Key 应通过 Fraq 的 `${{ env:VARIABLE_NAME }}` 引用，避免写入配置和生成入口。

配置变更后使用宿主的 `npm start` 重新生成 `app/package.json` 和 `app/index.js`，再确认 AI 插件、消费插件与
Hono 均能应用成功。

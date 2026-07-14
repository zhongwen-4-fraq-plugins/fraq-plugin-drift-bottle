# ⚠ AI SDK 媒体下载不会自动业务重试

SUMMARY: `generateText` 在模型请求前下载媒体 URL；瞬时 `fetch failed` 会直接抛出 `AI_DownloadError`，必须在插件层仅重试该错误。
READ WHEN: when moderation logs AI_DownloadError or a QQ media URL fetch failure

---

图片和视频以 URL 传给 AI SDK 时，SDK 会在转换模型输入阶段自行下载资源。这个阶段失败时可能直接抛出 `AI_DownloadError`，不会表现为模型调用重试。

同一 QQ 临时 URL 在报错后使用 Node `fetch` 可以正常返回，说明 `TypeError: fetch failed` 可能只是瞬时网络故障。

修复约束：

- 仅重试名称为 `AI_DownloadError` 的错误，避免重复模型请求或掩盖结构化输出错误。
- 重试整个 `generateText`，继续使用 AI SDK 内置的 URL 安全校验和下载大小限制。
- 达到重试上限后仍然拒绝投递，不得绕过审核。

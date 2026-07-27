# Cockpit — fraq-plugin-drift-bottle

Focus: `v0.3.2` 发布提交与本地标签已就绪；`github.com:443` TLS 失败阻止推送，远端尚未变化。

## In flight



## Next

- GitHub HTTPS Git 通道恢复后，推送 `main` 与 `v0.3.2`，确认发布成功，再自动更新 Fraq 宿主并关闭实例。
- 在宿主环境设置真实的 `OPENAI_API_KEY`，并在 Milky 服务可用时启动应用。
- 实现审核 API 和以待审核内容为核心的审核工作台。

## Open questions

- 当前网络何时恢复对 `github.com:443` 的 Git HTTPS 访问？

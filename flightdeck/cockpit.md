# Cockpit — fraq-plugin-drift-bottle

Focus: 旧 Fraq 后台实例已停止，本地最新 tarball 已重新安装，`127.0.0.1:4649` 保持空闲。

## In flight



## Next

- 使用 `npm run start:no-install` 重新启动 Fraq 宿主，确认 Hono 可以绑定 `127.0.0.1:4649`。
- 重新运行发布工作流，确认 Runner 可以完成依赖安装。
- 发布 `0.3.1`，更新宿主 `versions.yml`，替换当前仅适用于 `start:no-install` 的临时 tarball 安装。
- 在宿主环境设置真实的 `OPENAI_API_KEY`，并在 Milky 服务可用时启动应用。
- 实现审核 API 和以待审核内容为核心的审核工作台。

## Open questions

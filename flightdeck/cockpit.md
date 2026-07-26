# Cockpit — fraq-plugin-drift-bottle

Focus: 发布工作流已移除无法解析的 `pnpm/action-setup@v4`，改由 npm 安装锁定版本的 pnpm。

## In flight



## Next

- 重新运行发布工作流，确认 Runner 可以完成依赖安装。
- 发布 `0.3.1`，更新宿主 `versions.yml`，替换当前仅适用于 `start:no-install` 的临时 tarball 安装。
- 在宿主环境设置真实的 `OPENAI_API_KEY`，并在 Milky 服务可用时启动应用。
- 实现审核 API 和以待审核内容为核心的审核工作台。

## Open questions

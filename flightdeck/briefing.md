# Briefing — fraq-plugin-drift-bottle

## Conventions

- 不要频繁创建常量；仅当同一个值复用超过 3 次时才提取为常量。
- 每次产生改动后都必须创建一次 Git 提交。提交信息使用 [gitmoji](https://gitmoji.js.org/) 加简短改动说明的格式。
- 代码必须保持简洁，并以新手能够维护为准则。
- 提交代码前必须检查工作区；如果存在未提交内容，必须先提交。
- 根据代码的功能职责拆分文件，避免将无关功能集中在同一个文件中。
- 每次使用 Fraq 实例完成任务后，必须停止完整进程链并确认监听端口已释放；仅当用户明确要求持续运行时保留实例。
- 用户说“打 tag 提交”时，发布标签并确认远端发布成功后，自动更新 `D:\bot\fraq-plugins\my-fraq-app` 中的漂流瓶插件；验证完成后仍须关闭 Fraq 实例。

## Subscriptions

<!-- one ~/.flightdeck-relative path per line; empty = subscribe to nothing global -->

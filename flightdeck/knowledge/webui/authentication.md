# Fraq WebUI authentication checklist

SUMMARY: 始终只持久化 WebUI 密码哈希，初始明文只在首次生成时写入日志，并通过服务端会话与 HttpOnly Cookie 维持登录状态。
READ WHEN: before any WebUI password, login route, session, cookie, or authentication-state change

---

## 当前约定

- 插件第一次载入数据库时生成 10 位密码，必须同时包含大写字母、小写字母和数字。
- 初始密码只在生成当次写入 Fraq 日志；SQLite 仅保存带随机盐的 scrypt 哈希。
- 会话令牌由服务端随机生成并保存在内存中，因此插件重启后需要重新登录。
- Cookie 使用 WebUI 挂载路径、`HttpOnly` 和 `SameSite=Strict`；HTTPS 请求额外使用 `Secure`。
- 前端使用相对 API 地址，以兼容自定义和多层 `webuiPath`。
- 密码输入框在提交按钮左侧提供查看/隐藏按钮，使用 `aria-pressed` 表达状态；认证失败并清空输入时恢复隐藏。

## 验证要求

- 覆盖密码字符组成、只生成一次、错误密码、登录、会话查询和退出登录。
- 确认登录后前端地址进入 `<webuiPath>/app`，主页面内容由后续审核工作台提供。

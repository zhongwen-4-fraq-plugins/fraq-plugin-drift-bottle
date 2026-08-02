# Cockpit — fraq-plugin-drift-bottle

Focus: v0.3.21 已发布并通过真实 Fraq 宿主安装与资源验证，等待登录后合并转发视觉回归。

## In flight

- `manual-bottle-moderation` — 已随 v0.3.16 发布，AI/人工投瓶审核可即时切换，等待宿主回归。
- `ai-schema-response` — 结构诊断已发布；v0.3.19 真实网关暴露媒体下载瞬时失败，待补受限重试。
- `bottle-list-order` — 合并转发 Markdown 已随 v0.3.21 发布，宿主安装与资源链路通过，等待登录后视觉回归。
- `settings-restart-notice` — v0.3.19 宿主安装启动通过，等待登录后修改与撤销 WebUI 路径回归。

## Next

- 登录真实宿主，在桌面和移动端回归 QFace 普通表情与文字回退。
- 登录真实宿主，回归合并转发 Markdown、嵌套消息与无明细摘要。
- 仅针对 `AI_DownloadError` 重试一次完整审核调用，并覆盖成功恢复与耗尽失败测试。
- 登录真实宿主，在桌面和移动端回归评论正文对齐与待重启配置通知。
- 在宿主完成投瓶入队、机器人审核命令和人工通过回归。
- 完成 AI 结构化响应修复的真实网关回归。
- 在真实 Fraq 宿主中回归全部瓶子评论展开；后续按需增加评论管理操作。

## Open questions

- WebUI 是否继续保留 QQ 账号、主人审批和角色权限，还是切换到 `@fraqjs/plugin-webui-gateway` 的宿主级统一 access token。

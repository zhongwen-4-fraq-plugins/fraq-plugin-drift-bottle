# Cockpit - fraq-plugin-drift-bottle

Focus: v0.3.22 已发布；未发布改动已支持混合瓶子分段修改文字内容，并补全 AI 审核操作的对象与三类 Token 明细，等待发布和宿主回归。

## In flight

- `manual-bottle-moderation` - 已随 v0.3.16 发布，AI/人工投瓶审核可即时切换，等待宿主回归。
- `ai-schema-response` - AI 操作明细已补全；真实网关暴露的媒体下载瞬时失败仍待受限重试。
- `bottle-list-order` - 合并转发四条“名字：消息”预览、无自动分割线及展开/收起已完成，等待宿主回归。
- `settings-restart-notice` - v0.3.19 宿主安装启动通过，等待登录后修改与撤销 WebUI 路径回归。
- `bottle-list-crud` - 混合消息全部文字段已可分段修改并保留媒体，等待发布及登录后的完整 CRUD 回归。

## Next

- 用户方便时重启原有 `4649` 宿主，使运行实例加载已安装的 `0.3.22`。
- 登录真实 Fraq 宿主，用主人、管理员和普通账号回归瓶子新增、修改、删除及权限边界。
- 验证含媒体消息段的瓶子修改来源后仍保留原始消息段。
- 发布并在真实宿主验证混合瓶子文字编辑及 AI 审核操作的完整 Token 明细。
- 登录真实宿主，在桌面和移动端回归 QFace、合并转发、评论对齐与重启配置通知。
- 仅针对 `AI_DownloadError` 重试一次完整审核调用，并覆盖恢复与耗尽失败测试。
- 在宿主完成投瓶入队、机器人审核命令和人工通过回归。

## Open questions

- WebUI 是否继续保留 QQ 账号、主人审批和角色权限，还是切换到 `@fraqjs/plugin-webui-gateway` 的宿主级统一 access token。

# WebUI login success feedback checklist

SUMMARY: 始终在认证成功后先让登录按钮的箭头渐隐并切换为勾号，再进入主页面；反馈总时长保持在 500ms 内，并为减少动态效果模式直接切换状态。
READ WHEN: before any login submit button, post-auth navigation, or login success animation change

---

- 只有服务端确认密码正确后才显示成功状态，不能用乐观动画代替认证结果。
- 箭头退出约 120ms，勾号在其后用约 180ms 进入；约 420ms 后导航，避免成功状态一闪而过。
- 动画只使用 `opacity` 和 `transform`，不改变按钮尺寸或表单布局。
- `prefers-reduced-motion: reduce` 下禁用关键帧、直接显示勾号，并将确认等待缩短到约 120ms。
- 成功状态使用可访问名称和 `role="status"`，不能只依赖颜色或图标传达结果。

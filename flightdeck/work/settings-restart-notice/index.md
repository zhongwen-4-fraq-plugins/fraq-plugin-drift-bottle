# Index — settings restart notice

## State

WebUI 设置页已在右上角显示可关闭的待重启提示，并随 v0.3.19 发布；真实 Fraq 宿主安装启动通过，等待登录后交互回归。

## Next

- 登录真实 Fraq 宿主修改、撤销 WebUI 路径，回归提示的显示与清除。

## Read now

- `flightdeck/knowledge/webui/restart-required-settings-feedback.md`

## Read if

- `flightdeck/knowledge/webui/nested-route-urls.md` — 如果新增更多需要重启的路径配置。

## Progress

Done:

- 保存需重启配置后显示持久、可关闭的右上角状态通知。
- 页面载入已有待重启状态时恢复通知；恢复当前生效路径后自动清除。
- 保存即时生效配置时不重复唤起已关闭的待重启通知。
- 将显示、保持与清除转换提取为纯状态函数，并用聚焦测试锁定三条分支。
- 保留表单内联保存结果，并覆盖 hover、focus、forced-colors 与移动端安全边距。

Verified:

- `pnpm check`
- `pnpm test`（43 项全部通过）
- `pnpm build`
- Impeccable 检测（0 项）
- Chrome 900px 桌面与 328px 移动通知截图
- GitHub Publish 工作流、GitHub Release 与 npm `0.3.19` 发布成功。
- 真实 Fraq CLI 0.7 宿主安装 `0.3.19` 并启动成功；WebUI 页面、会话接口返回 `200`，发布脚本包含版本号与重启提示文案。
- 验证结束后完整 Fraq 进程链已停止，`4649` 端口已释放。

## Open questions

无。

# ⚠ Fraq CLI install 不会重新生成应用清单

SUMMARY: Fraq CLI 0.7 的 `fraq install` 只在既有 `app/package.json` 上安装依赖；修改插件配置后必须运行一次 `fraq start` 才会重新生成应用清单和入口。
READ WHEN: when installing plugins after changing fraq.yml or versions.yml leaves app/package.json or app/index.js unchanged

---

Fraq CLI 0.7 的 `installOnly()` 直接调用依赖安装，而生成 `app/package.json` 和 `app/index.js` 的逻辑只在
`startApp()` 中执行。因此仅运行 `fraq install` 会继续使用旧插件清单。

可靠流程：

1. 更新 `fraq.yml` 和 `versions.yml`。
2. 运行一次 `fraq start`，让 CLI 生成应用文件并执行包管理器安装。
3. 看到插件成功应用后停止验证进程；随后可以使用 `fraq start --no-install` 快速启动。

Windows 宿主如果带有 CLI 检测补丁脚本，应从宿主的 `npm start` 入口启动，避免全局 `fraq` 错判 npm 不在 PATH。

# ⚠ Fraq CLI 0.7 无法从 versions.yml 加载本地包

SUMMARY: Fraq CLI 0.7 的插件依赖诊断会把非 `latest` 字符串拼成 npm registry URL，因此未发布构建不能用 `file:` 写入 `versions.yml`，只能临时安装 tarball 并以 `start:no-install` 运行。
READ WHEN: when installing an unpublished local Fraq plugin build into a Fraq CLI 0.7 host

---

`versions.yml` 的 schema 虽然接受任意字符串，但 `getPackageJson(packageName, version)` 会直接请求
`https://registry.npmjs.org/<package>/<version>`。`file:`、本地路径和 tarball 规格都会在启动前的插件 peer
依赖诊断阶段失败。

临时更新流程：

1. 在插件仓库运行 `npm pack --pack-destination <宿主缓存目录>`，确保安装的是包含完整构建产物的 tarball。
2. 停止正在运行的宿主，避免旧进程继续使用已加载的旧模块。
3. 在宿主 `app/` 中运行 `npm install --no-save --package-lock=false --legacy-peer-deps <tarball>`。
4. 使用宿主的 `npm run start:no-install` 启动，并通过实际 WebUI API 验证新行为。

这种安装只适合等待发布期间验证。宿主再次运行普通 `npm start` 时会按 `versions.yml` 重新生成依赖清单，
可能恢复 npm registry 中的同版本包；正式更新仍应发布新版本并更新 `versions.yml`。

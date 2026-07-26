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
5. 验证结束后，要么明确把该进程交接为持续运行的宿主，要么停止完整进程链并确认监听端口已经释放。

如果后续启动报 `EADDRINUSE`，先用 `Get-NetTCPConnection` 找到监听 PID，再沿父进程链确认它确实属于目标
Fraq 宿主；确认后停止旧进程链，不要直接结束未经识别的同端口进程。

普通 `npm start` 会在尝试绑定 Hono 端口之前重新生成并安装依赖，因此即使最后因 `EADDRINUSE` 退出，
本地 tarball 也可能已经被 registry 同版本包覆盖。释放端口后要重新比较本地与宿主 bundle 哈希；不一致时
再次安装 tarball。registry 不可达而本地依赖齐全时，可为安装命令增加 `--offline --no-audit --no-fund`。

这种安装只适合等待发布期间验证。宿主再次运行普通 `npm start` 时会按 `versions.yml` 重新生成依赖清单，
可能恢复 npm registry 中的同版本包；正式更新仍应发布新版本并更新 `versions.yml`。

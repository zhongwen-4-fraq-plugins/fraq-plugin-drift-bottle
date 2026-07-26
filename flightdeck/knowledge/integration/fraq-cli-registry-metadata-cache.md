# ⚠ Fraq CLI 0.7 的插件元数据查询忽略 npm registry 配置

SUMMARY: Fraq CLI 0.7 在依赖诊断中硬编码访问 `registry.npmjs.org`；官方 registry 超时时，应从可信镜像核对版本后写入宿主 `cache/package-json`，再用一次性项目 `.npmrc` 完成安装。
READ WHEN: when `fraq start` fails in `getPackageJson` with `UND_ERR_CONNECT_TIMEOUT` or `fetch failed`

---

Fraq CLI 0.7 的 `getPackageJson(packageName, version)` 不读取 npm registry 配置，而是直接请求
`https://registry.npmjs.org/<package>/<version>`。所以即使 npm 可以通过镜像安装，CLI 也可能在安装前的
插件 peer 依赖诊断阶段退出。

恢复流程：

1. 从可信 npm 同步镜像查询精确包版本，核对 `version`、`gitHead`、完整性和 `peerDependencies`。
2. 在宿主 `cache/package-json/<package>@<version>.json` 写入对应 metadata；CLI 0.7 的诊断至少需要
   `name`、`version` 和 `peerDependencies`。
3. 在宿主根目录创建一次性 `.npmrc`，仅为本次 `npm start` 指定可达镜像，让生成后的应用完成安装。
4. 确认 WebUI、实际安装版本和插件行为后立即删除该 `.npmrc`，不要修改全局 registry。

缓存只绕过 CLI 的 metadata 请求，不代替包完整性核对，也不应跨版本复用。

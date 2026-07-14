# ⚠ npm 官方 registry 可能解析到不可达的代理地址

SUMMARY: npm 发布成功后若官方 registry 连接超时，可用同步镜像验证版本与 attestation，并仅为本次安装指定镜像。
READ WHEN: when npm view or pnpm install times out after a successful publish action

---

本机代理 DNS 可能把 `registry.npmjs.org` 解析到 `198.18.x.x`，Node 会报 `UND_ERR_CONNECT_TIMEOUT`。这不代表发布失败；先以 GitHub Action 结论为准，再验证 registry 状态。

恢复步骤：

1. 查询 `https://registry.npmmirror.com/<package>/<version>`，核对版本、完整性和 `dist.attestations.provenance`。
2. 不修改全局 npm registry。
3. 若宿主启用了新版本等待策略，先把版本加入现有 `minimumReleaseAgeExclude`。
4. 仅对本次安装运行 `pnpm install --registry=https://registry.npmmirror.com`。
5. 最后运行类型检查、离线冻结锁文件安装和 `pnpm list`。

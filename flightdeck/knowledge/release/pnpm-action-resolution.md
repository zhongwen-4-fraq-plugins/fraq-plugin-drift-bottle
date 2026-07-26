# ⚠ pnpm setup Action 可能无法被 Runner 解析

SUMMARY: GitHub Runner 无法解析 `pnpm/action-setup@v4` 时，应先用官方 `actions/setup-node` 配置 Node，再通过 npm 安装锁定版本的 pnpm，并移除依赖 pnpm 已存在的 setup-node 缓存选项。
READ WHEN: when GitHub Actions reports "Unable to resolve action pnpm/action-setup@v4"

---

这个错误发生在 Action 下载阶段，不是 `pnpm install` 本身失败。确认 `uses:` 没有拼写错误或隐藏字符后，
可以完全移除第三方 setup Action：

1. 运行 `actions/setup-node@v4`，指定项目支持的 Node 版本。
2. 运行 `npm install --global pnpm@<锁定版本>`。
3. 再执行 `pnpm install --frozen-lockfile`。

不要保留 `actions/setup-node` 的 `cache: pnpm`，因为该 Action 在缓存初始化阶段需要 pnpm 已经存在，
而此流程会在 setup-node 之后才安装 pnpm。若以后需要恢复缓存，应在安装 pnpm 后单独使用官方
`actions/cache` 和 `pnpm store path` 配置。

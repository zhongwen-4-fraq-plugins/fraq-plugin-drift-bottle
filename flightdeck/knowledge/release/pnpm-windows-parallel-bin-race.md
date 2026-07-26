# ⚠ Windows 并行 pnpm 命令会竞争 .bin

SUMMARY: 同一工作区并行运行多个 pnpm 命令可能同时重建 `node_modules/.bin`，产生 `ENOENT` 或 `EPERM chmod` 警告；发布验证应顺序执行安装、检查、测试和构建。
READ WHEN: when parallel pnpm checks emit "Failed to create bin", ENOENT, or EPERM chmod warnings on Windows

---

在 Windows 的同一 pnpm workspace 中并行启动 `pnpm check`、`pnpm test` 和 `pnpm build` 时，各进程可能同时
维护根目录及子 workspace 的 `.bin` 入口。即使任务最终成功，也会出现 `Failed to create bin`、`ENOENT`
或 `EPERM` 警告，使发布验证结果带有不确定性。

恢复方式是先单独运行 `pnpm install --frozen-lockfile`，再顺序运行 `pnpm check`、`pnpm test` 和
`pnpm build`。发布前不要在同一工作区并行执行这些 pnpm 命令。

# Index — release-v0.3.14

## State

正在准备 `v0.3.14`，包含内容类型标签与完整人工审核。

## Next

- 顺序执行检查、测试和构建。
- 提交版本，推送主分支与 `v0.3.14` Tag，确认 GitHub Actions 与 npm 发布。
- 更新 `D:\bot\fraq-plugins\my-fraq-app`，验证版本后关闭 Fraq 进程链。

## Read now

- `package.json`
- `src/webui/dashboard.ts`
- `test/dashboard.test.ts`
- `.github/workflows/publish.yml`
- `flightdeck/knowledge/integration/fraq-cli-install-generation.md`

## Read if

- `flightdeck/knowledge/release/github-push-timeout.md` — 如果 GitHub 推送超时。
- `flightdeck/knowledge/release/npm-registry-timeout.md` — 如果 npm 发布后查询超时。
- `flightdeck/knowledge/release/pnpm-windows-parallel-bin-race.md` — 如果 pnpm 验证出现 `.bin`、ENOENT 或 EPERM。
- `flightdeck/knowledge/integration/fraq-cli-registry-metadata-cache.md` — 如果 Fraq CLI 查询 npm metadata 超时。

## Progress

Done:
- 确认上一标签为 `v0.3.13`，工作区起始状态干净。
- 确认发布范围为内容类型标签和完整人工审核。
- 版本与主页更新日志已更新到 `0.3.14`。

Current:
- 提交版本并推送主分支与 `v0.3.14` Tag。

Verified:
- `pnpm install --frozen-lockfile` 成功。
- `pnpm check` 成功。
- `pnpm test` 通过 33 项测试。
- `pnpm build` 成功。

## Open questions

无。

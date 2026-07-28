# Index — release-v0.3.13

## State

`v0.3.13` 已通过完整验证，等待提交、创建并推送 Tag。

## Next

- 更新版本、主页更新日志与测试。
- 验证并推送 Tag，确认 npm 发布。
- 更新 Fraq 宿主并完成发布状态提交。

## Read now

- `package.json`
- `pnpm-lock.yaml`
- `src/webui/dashboard.ts`
- `test/dashboard.test.ts`
- `.github/workflows/publish.yml`

## Read if

- `flightdeck/knowledge/release/github-push-timeout.md` — 如果推送 GitHub 超时。
- `flightdeck/knowledge/release/npm-registry-timeout.md` — 如果 npm 发布后查询超时。
- `flightdeck/knowledge/release/pnpm-windows-parallel-bin-race.md` — 如果 pnpm 验证出现 `.bin`、ENOENT 或 EPERM 错误。

## Progress

Current:
- 提交版本并推送 `v0.3.13` Tag。

Done:
- 确认 `v0.3.12` 为上一版本且工作区没有遗留代码改动。
- `package.json`、主页更新日志与测试断言已更新到 `0.3.13`。
- `pnpm check`、31 项测试与生产构建通过。

## Open questions

无。

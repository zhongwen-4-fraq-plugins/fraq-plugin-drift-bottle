# ⚠ @fraqjs/mock 的 Fraq peer 范围可能滞后

SUMMARY: `@fraqjs/mock@0.1.0` 仍声明 `@fraqjs/fraq ^0.6.0`；升级 Fraq 后应先验证测试，再为这个精确依赖对添加 pnpm 允许范围。
READ WHEN: when upgrading Fraq causes pnpm to report an unmet @fraqjs/mock peer dependency

---

`@fraqjs/fraq@0.14.0` 的源码包仍以 `@fraqjs/mock@^0.1.0` 作为开发依赖，但 `@fraqjs/mock@0.1.0` 发布清单中的 Fraq peer 范围停留在 `^0.6.0`。因此安装器会报告 unmet peer，实际 API 是否兼容需要由类型检查和测试确认。

处理步骤：

1. 先确认 registry 中没有更新的 `@fraqjs/mock` 版本。
2. 运行完整类型检查和测试，确认当前 Fraq 版本可用。
3. 仅在 `pnpm-workspace.yaml` 的 `peerDependencyRules.allowedVersions` 中允许 `@fraqjs/mock>@fraqjs/fraq` 对应的已验证版本范围，不要放宽其他包。
4. 后续 mock 发布了正确 peer 范围后，删除该例外并重新运行 `pnpm peers check`。

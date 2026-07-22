# ⚠ pnpm link 可能破坏 Fraq 服务类身份

SUMMARY: 本地 Fraq 插件使用 `link:` 时可能从源码仓库解析另一份 peer 插件，使同名服务 class 身份不同并导致依赖注入失败；应改用 `file:` 或打包产物测试。
READ WHEN: when a locally linked Fraq plugin reports a required service missing even though its provider plugin is installed

---

Fraq 使用服务 class 构造器作为依赖注入键。pnpm 的 `link:` 会把插件直接软链接到源码仓库；插件内部的 peer import 因此可能从源码仓库自己的 `node_modules` 解析，而宿主应用从宿主的 `node_modules` 解析。即使两边包名和版本完全相同，两份模块实例导出的 class 也不是同一个键。

典型症状是提供方插件已经安装，启动仍报告 `Unable to resolve plugin service dependencies`。例如宿主安装了 AI 插件，但本地链接的消费插件仍提示没有插件提供 `AiService`。

处理方式：

1. 将本地依赖从 `link:../plugin` 改为 `file:../plugin`，或先生成 tarball 再安装。
2. 重新安装依赖，使插件的 peer dependencies 在宿主依赖图中统一解析。
3. 运行真实的 `Context.install` / `Context.start` 集成测试；不要只验证 TypeScript 能否导入。

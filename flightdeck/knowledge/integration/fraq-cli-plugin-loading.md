# Fraq CLI 插件加载 checklist

SUMMARY: 始终保持默认导出为可由 CLI 动态安装的插件描述，并把跨插件能力声明为 `provides` 服务和根命名导出。
READ WHEN: before changing any Fraq plugin entry point, package export, configuration option, or provided service

---

Fraq CLI 0.7 从 `fraq.yml` 递归读取根上下文和 forks 中的插件，把短名规范化为 npm 包名：

- `name` → `fraq-plugin-name`
- `fraqjs/name` → `@fraqjs/plugin-name`
- `scope/name` → `@scope/fraq-plugin-name`

CLI 生成独立的 ESM 应用和 `package.json`，安装锁定版本后，对每个插件生成：

```ts
ctx.install((await import(packageName)).default, jsonOptions);
```

因此：

1. 包根的默认导出必须是 `definePlugin(...)` 结果，不能替换成 API 实例或命令构建器。
2. CLI 传入的是 YAML 解析后再 JSON 序列化的普通配置对象；插件选项不能依赖函数或 class 实例。
3. 供其他插件复用的能力应以 class 作为服务 token，在 `provides` 中声明并在 `apply` 中 `ctx.provide`，同时从包根命名导出。
4. 命令注册属于默认插件的装配过程；服务 API 不应要求调用者持有 `Session` 或重新构建命令路由。
5. CLI 会根据插件包的 `peerDependencies` 检查同一上下文或父上下文是否安装了依赖插件；调整服务依赖时要同步检查包元信息。

验证入口至少覆盖：CLI 风格 JSON 配置可安装默认导出、声明的服务确实被提供、根声明文件同时包含默认导出与命名 API。

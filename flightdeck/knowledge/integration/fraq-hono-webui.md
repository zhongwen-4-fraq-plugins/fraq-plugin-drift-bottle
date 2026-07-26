# Fraq Hono WebUI checklist

SUMMARY: 始终注入 `HonoService` 并在插件 `apply` 期间注册 WebUI 路由，不要由业务插件单独监听 HTTP 端口。
READ WHEN: before any Fraq HTTP route, WebUI mount path, static asset serving, or Hono dependency change

---

`@fraqjs/plugin-hono@0.2.1` 提供 `HonoService`：

- `HonoService.app` 是所有插件共用的 Hono 应用。
- Hono 插件在自己的 `start` 阶段调用 `listen()`；业务插件只注册路由。
- 依赖 Hono 的插件要在 `inject` 中声明 `HonoService`，并把 `@fraqjs/plugin-hono` 列为 peer dependency，让 Fraq CLI 检查 `fraqjs/hono` 配置。

漂流瓶 WebUI 默认挂载到 `/drift-bottle/`，`webuiPath` 可修改路径。无尾斜杠路径使用 308 重定向，以保证 Vite 的 `./assets/...` 相对 URL 始终在挂载目录下解析。

静态服务需要保持：

- `index.html` 使用 `no-cache`。
- 带哈希的 Vite 资源使用长期 immutable 缓存。
- 无扩展名的前端路由回退到 `index.html`。
- 资源路径必须经过根目录越界检查。
- 注册路由后使用规范化挂载路径和 Hono 的 host/port 输出完整 WebUI 地址；通配监听地址应转换为本机可访问的回环地址。

发布前用构建后的 `dist/index.mjs` 实际请求 WebUI 路由，不只验证源码级路由函数。

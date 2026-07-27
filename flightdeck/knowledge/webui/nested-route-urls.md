# WebUI nested route URL checklist

SUMMARY: 始终从 WebUI 挂载根构建 API 和前端页面 URL；深层前端路由不能直接用 `./api`，否则请求会落到错误的子目录。
READ WHEN: before any WebUI frontend route, API fetch path, or navigation-state change

---

漂流瓶 WebUI 支持自定义且可能多层的 `webuiPath`，同时使用 Hono SPA fallback 提供 `/app`、`/bottles` 和
`/reviews/pending` 等前端路由。

浏览器在 `/reviews/pending` 上解析 `./api/reviews/pending` 时会得到 `/reviews/api/reviews/pending`，而不是挂载根下的
`/api/reviews/pending`。因此前端统一使用 `webui/src/location.ts`：先移除已知页面路由后缀，得到 WebUI 挂载根，再构建
API URL 和 History API 导航目标。登录页、主页和深层列表页都必须走同一工具，不能各自拼接相对路径。

验证新增前端路由时至少覆盖：直接访问深层路由、刷新页面、登录过期、浏览器前进/后退，以及自定义多层
`webuiPath` 下的 API 请求路径。

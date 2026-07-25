# WebUI workspace checklist

SUMMARY: 始终在 `webui/` 独立开发管理后台，并由根构建把产物写入 `dist/webui` 供 Hono 发布。
READ WHEN: before any WebUI dependency, entry point, build configuration, or workspace layout change

---

漂流瓶管理后台位于 `webui/`，使用 React、TypeScript 和 Vite。前端保持独立入口和开发服务器，但发布构建由根脚本统一编排：先生成插件 bundle，再把 Vite 产物写入 `dist/webui`。根包的 `files: ["dist"]` 会将两者一起发布。

- 开发：`pnpm webui:dev`
- 完整发布构建：`pnpm build`
- 仅重建前端：`pnpm webui:build`
- 全仓检查：`pnpm check`，其中包含 WebUI TypeScript 检查
- HTML 入口：`webui/index.html`
- React 入口：`webui/src/main.tsx`
- 页面根组件：`webui/src/App.tsx`
- 全局主题与基础样式：`webui/src/styles.css`
- 生产输出：`dist/webui/`

`webui/.impeccable/live/config.json` 已覆盖 Vite 的单页 HTML 入口。新增独立 HTML 页面时要同步扩大该配置的 `files` 范围。

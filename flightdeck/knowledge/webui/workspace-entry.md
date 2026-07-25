# WebUI workspace checklist

SUMMARY: 始终把管理后台作为 `webui/` 独立 Vite workspace 维护，并通过根脚本统一检查和构建。
READ WHEN: before any WebUI dependency, entry point, build configuration, or workspace layout change

---

漂流瓶管理后台位于 `webui/`，使用 React、TypeScript 和 Vite。插件库仍由根目录 `tsdown` 独立构建，两者不要混合入口或输出目录。

- 开发：`pnpm webui:dev`
- 生产构建：`pnpm webui:build`
- 全仓检查：`pnpm check`，其中包含 WebUI TypeScript 检查
- HTML 入口：`webui/index.html`
- React 入口：`webui/src/main.tsx`
- 页面根组件：`webui/src/App.tsx`
- 全局主题与基础样式：`webui/src/styles.css`

`webui/.impeccable/live/config.json` 已覆盖 Vite 的单页 HTML 入口。新增独立 HTML 页面时要同步扩大该配置的 `files` 范围。

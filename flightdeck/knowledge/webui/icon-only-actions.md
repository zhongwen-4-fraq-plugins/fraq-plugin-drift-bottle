# WebUI icon-only action checklist

SUMMARY: 始终为纯图标操作保留明确的可访问名称、键盘可见的文字提示和至少 44px 的粗指针目标，不能只依赖图形表达含义。
READ WHEN: before any WebUI text link or action is converted to an icon-only control

---

- 图标 SVG 使用 `aria-hidden="true"`，把完整动作名称放在链接或按钮本身；打开新标签页时也要在可访问名称中说明。
- 文字提示必须同时响应悬停和键盘焦点，不能只依赖浏览器 `title` 或鼠标事件。
- 默认状态保持中性，只有交互或语义状态才使用主色，避免次要工具抢占内容层级。
- 使用布局流和 `margin-top: auto` 放置底部工具组，避免绝对定位覆盖动态内容。
- 视觉目标可以小于 44px，但在 `pointer: coarse` 下点击区域必须至少达到 44×44px。

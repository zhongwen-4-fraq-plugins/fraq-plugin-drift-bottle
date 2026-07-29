# Responsive list detail expansion

SUMMARY: 列表只携带详情计数，展开时再从认证接口懒加载；桌面表格和移动列表必须共享同一份展开状态与详情缓存，避免隐藏视图重复请求。
READ WHEN: before adding expandable details to a responsive WebUI list that renders separate desktop and mobile structures

---

响应式列表可能同时渲染桌面表格和移动列表，再通过 CSS 隐藏其中一个。如果每个视图各自维护请求状态，一次展开可能造成重复请求，切换断点后也会丢失已加载内容。应在两种视图的共同父组件中按记录 ID 保存展开状态和详情缓存，并把同一个切换函数、加载状态和重试函数传给两个视图。

列表接口只返回判断是否显示入口所需的轻量计数；详情内容由受认证的独立接口在首次展开时读取。后续收起、展开直接复用缓存，只有失败重试时重新请求。API URL 必须继续通过 WebUI 挂载根工具构建，以兼容多层自定义路径。

展开区需要同时覆盖加载、失败、重试、空结果和截断总数提示。按钮用 `aria-expanded` 与 `aria-controls` 关联面板；隐藏内容不可保留可聚焦元素。展开动效使用短时状态过渡，并为 `prefers-reduced-motion` 提供无动画版本。

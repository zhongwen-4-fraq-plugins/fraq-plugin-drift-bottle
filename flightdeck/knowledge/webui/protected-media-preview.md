# Protected media preview

SUMMARY: WebUI 列表只下发瓶子 ID 与媒体消息段索引；用户点击后再通过受认证接口刷新资源 URL，不能长期依赖数据库中的 QQ 临时地址。
READ WHEN: before adding image, video, or other stored message media previews to the authenticated WebUI

---

QQ 媒体地址可能过期，列表响应也不应批量刷新每一页的所有资源。内容摘要需要保留原消息段索引，前端只显示轻量的查看入口；点击后通过 WebUI 挂载根构建受认证 API URL，由插件按瓶子 ID 和消息段索引读取当前记录，并向 Milky 请求最新资源地址。刷新失败时才使用数据库中的临时地址回退。

接口必须验证会话、非负整数索引和消息段类型，不能允许调用方提交任意外部 URL。响应使用 `Cache-Control: no-store`，区分瓶子不存在、消息段不是目标媒体和资源暂不可用。

预览层使用原生 `dialog`，支持 Escape、显式关闭、点击遮罩关闭、加载状态、失败重试、图片加载失败和移动端视口约束。远程图片使用 `referrerPolicy="no-referrer"`，并始终限制在视口内等比显示。

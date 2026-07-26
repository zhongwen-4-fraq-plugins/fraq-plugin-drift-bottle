# WebUI owner avatar checklist

SUMMARY: 始终从 `ownerIds` 第一项派生登录页主人头像，并让头像缺失或加载失败只影响展示、不阻断登录。
READ WHEN: before any WebUI owner avatar, session bootstrap response, or ownerIds-to-UI identity change

---

- 主人身份来源保持为插件配置的 `ownerIds[0]`，不要另建重复配置。
- 服务端将有效 QQ 号转换为 `https://q1.qlogo.cn/g?b=qq&nk=<QQ号>&s=640`，通过带 `Cache-Control: no-store` 的会话查询响应提供给前端。
- 未配置主人、QQ 号无效或图片加载失败时，登录页回退到本地占位头像；头像不是认证条件。

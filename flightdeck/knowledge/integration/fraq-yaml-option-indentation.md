# ⚠ Fraq YAML 插件选项缩进错误会被当作插件

SUMMARY: `fraq.yml` 中插件选项必须缩进到插件键下；与插件同级的 `port` 等选项会被 CLI 当作 `fraq-plugin-port` 一类插件并尝试解析。
READ WHEN: when Fraq CLI tries to resolve a package named after a configuration option such as port

---

Fraq CLI 读取 `plugins` 下的每个同级键作为插件名。例如 Hono 配置必须是：

```yaml
plugins:
  fraqjs/hono:
    host: 127.0.0.1
    port: 4649
```

如果 `port` 只缩进两格并与 `fraqjs/hono` 同级，CLI 会尝试获取不存在的 `fraq-plugin-port`，报
`Failed to resolve the latest version for plugin "port"`。修复时要校正缩进，而不是为这个伪插件添加版本。

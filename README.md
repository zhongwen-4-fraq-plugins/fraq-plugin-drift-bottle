# fraq-plugin-drift-bottle

Fraq 的匿名漂流瓶插件，提供“扔漂流瓶”和“捡漂流瓶”两个指令。

需要 Node.js 22.13.0 或更高版本。

## 安装

```bash
pnpm add fraq-plugin-drift-bottle
```

## 使用

```ts
import DriftBottlePlugin from 'fraq-plugin-drift-bottle';

ctx.install(DriftBottlePlugin, {
  storagePath: './data/drift-bottles.db',
  deleteAfterPick: false,
});
```

- `扔漂流瓶 <内容>`：匿名保存一条漂流瓶消息。
- `捡漂流瓶`：随机捡取一条漂流瓶消息。

漂流瓶使用 SQLite 存储。`storagePath` 可选，默认使用运行目录下的 `./data/drift-bottles.db`。

`deleteAfterPick` 控制瓶子被捡取后是否删除，默认为 `false`；设置为 `true` 后，瓶子只会被捡到一次。

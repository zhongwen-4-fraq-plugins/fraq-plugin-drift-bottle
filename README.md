# fraq-plugin-drift-bottle

Fraq 的匿名漂流瓶插件，提供“扔漂流瓶”和“捡漂流瓶”两个指令。

## 安装

```bash
pnpm add fraq-plugin-drift-bottle
```

## 使用

```ts
import DriftBottlePlugin from 'fraq-plugin-drift-bottle';

ctx.install(DriftBottlePlugin, {
  storagePath: 'data/drift-bottles.json',
});
```

- `扔漂流瓶 <内容>`：匿名保存一条漂流瓶消息。
- `捡漂流瓶`：随机捡取并移除一条漂流瓶消息。

`storagePath` 可选，默认使用运行目录下的 `data/drift-bottles.json`。

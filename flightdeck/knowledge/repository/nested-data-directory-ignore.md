# ⚠ `data/` 规则会忽略嵌套源码目录

SUMMARY: 仓库 `.gitignore` 的无前导斜杠 `data/` 会匹配任意层级目录，导致 `src/data/` 中的新源码不出现在 Git 状态里。
READ WHEN: when files created under a data directory do not appear in git status or a staged refactor unexpectedly shows only deletion

---

本仓库用 `data/` 忽略运行时数据。Git 的这种目录模式不仅匹配仓库根 `data/`，也匹配 `src/data/` 等嵌套目录。

源码分类不要使用 `data/` 目录名；持久化实现使用 `src/persistence/`。完成文件移动后必须执行：

```bash
git status --short
git check-ignore -v <missing-path>
```

若状态中只有旧文件删除而没有新文件新增，先检查 ignore 规则，不要提交不完整的重命名。

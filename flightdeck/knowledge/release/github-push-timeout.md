# ⚠ GitHub 标签发布可能部分推送成功

SUMMARY: GitHub 443 超时可能让主分支已推送而标签仅留在本地；重试前必须分别检查每个引用。
READ WHEN: when GitHub push times out while publishing a tag

---

发布命令在主分支推送、创建本地标签和推送标签之间可能因网络超时中断，不能直接整段重跑。

恢复步骤：

1. 用 `git status --short --branch` 和 `git ls-remote --heads origin main` 核对主分支。
2. 用 `git tag --list <tag>` 核对本地标签。
3. 用 `git ls-remote --tags origin refs/tags/<tag>` 核对远程标签。
4. 只重试缺失的步骤；本地标签已存在时不要再次创建。

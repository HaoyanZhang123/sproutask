# 教程（docs/tutorials）

## 当前工作流（看这里就够）

项目已经是可运行的 TypeScript/Electron 实现，不需要跟教程从零搭：

```powershell
pnpm install
cp .env.example .env      # 填 DeepSeek API Key
pnpm dev                  # 启动桌面应用
pnpm chat                 # 终端里和小芽对话
pnpm typecheck && pnpm test
```

细节见仓库根 `README.md` 的「快速开始」。

## 关于早期教程（已删除）

这里的 `00-总览 / 01-环境准备 / 02-提示词沙盒` 三篇是 **M0 时期**写的，描述的是当时的技术路线：
"闯关地图"式编排、整单元教材原文注入、Python FastAPI 提示词沙盒（`backend/`）、旧项目名 BioBuddy。
这些做法后来全部被取代（编排方案被否决；教材改为全册结构化按需装载；`backend/` 已删除；项目改名「芽问 SproutAsk」）。

**2026-09-24 决定：直接删除，不留存档副本**——理由是"看着像能用的过时文档"比"没有文档"更危险，
而 git 历史本身就是最完整的存档。

**需要时怎么找回**（内容仍在 git 历史里，删除前的最后一个提交是 `15d4638`）：

```powershell
git show 15d4638:docs/tutorials/archive-M0/02-提示词沙盒.md
# 或整篇恢复：
git checkout 15d4638 -- docs/tutorials/archive-M0/
```

## 待办

如需按**当前实现**写一套新的保姆级教程（例如"如何给这个 Agent 加一个新工具""如何新增一节教材内容"），
列入 `TASKS.md` 候选。当前优先做的是教材内容工程与教材阅读视图。

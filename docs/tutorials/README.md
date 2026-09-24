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

## 目录内容

| 文件 | 状态 |
|---|---|
| `00-总览.md`、`01-环境准备.md`、`02-提示词沙盒.md` | ⚠️ **M0 时期存档（已废弃）**——描述的是早期技术路线（闯关地图、整单元原文注入、Python `backend/` 沙盒、旧项目名 BioBuddy）。`backend/` 已于 2026-09 删除。 |

**为什么保留**：这三篇记录了"从零开始、一路改过来"的过程，是研习报告里"开发者反思"的素材；
其中通用的环境安装步骤仍有参考价值。

**注意**：存档文档里的命令**不要照抄**（`backend/` 已不存在）。

## 待办

如需按**当前实现**重写一套保姆级教程（例如"如何给这个 Agent 加一个新工具""如何新增一节教材内容"），
列入 `TASKS.md` 的候选；当前优先做的是教材内容工程与阅读视图。

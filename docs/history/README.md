# 历史归档（只读）

2026-11-04 起，本仓库只有一条产品线：`education/`（运行在 DSH 内核上的教育 Agent）。
这里保存**旧 Electron + Vue 线**（v0.1.0–v0.2.0）的文档、规范、调研工具和评测数据，仅供回查，**不要在这里继续开发**。

## 最后状态

- 归档点名：tag `pre-cleanup-2026-11-04`
- 归档时 `main` 的提交：`7601ea7`（v0.3.1 之后）
- 旧线代码本身不再保留在工作区，全部在 git 历史里，可按下面的方式找回。

## 目录

| 路径 | 内容 |
|---|---|
| `PROGRESS-legacy.md` | 旧线工程进度日志（到 2026-10-29 交接为止） |
| `ARCHITECTURE-legacy.md` | 旧线架构（Vue / Electron / core 分层） |
| `CONVENTIONS-legacy.md` | 旧线编码规范 |
| `AGENTS-legacy.md` | 旧线开工仪式与质量门 |
| `HANDOFF.md` / `ROADMAP.md` / `TASKS.md` / `CODEBASE_NOTES.md` | 旧线交接、路线、需求明细、环境笔记 |
| `adr/` | 旧线 ADR-0001–0007（含"教材原文只在本机"这条仍然有效的决策来源） |
| `specs/` | 旧线 F-00X 需求规格 |
| `tutorials/` | 旧线安装/使用教程与真人验收清单 |
| `publish/` | 旧线开源发布白名单、扫描脚本与 electron-builder 配置 |
| `tools/` | 旧线教材提取 / OCR / 文档转换脚本（Python） |
| `legacy-evals/` | 旧线教学行为评测用例与历史报告 |
| `v0.1.0-alpha.md` / `v0.2.0-alpha.md` | 旧线发布说明 |

## 怎么找回旧线代码

```bash
# 看某个文件在归档点的样子
git show pre-cleanup-2026-11-04:src/core/agent/loop.ts

# 把整个旧线检出到一个临时目录（不会污染工作区）
git worktree add ../ai4edu-legacy pre-cleanup-2026-11-04
```

用完删掉那个 worktree 即可。

## 哪些旧结论仍然有效

- **教材原文与课标原文只在本机**：不进 git、不随包、不进公开仓库（原 ADR-0007）。
- **不做教师端**、学生只用编号、研习数据以问卷为主渠道。
- **密钥不进 renderer / 不进日志 / 不进截图**。
- 其余关于 Vue 组件、IPC 通道、四模式对话、自检开关等，都只属于旧线，不再约束新线。

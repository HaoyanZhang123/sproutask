# AGENTS.md

> BioBuddy —— 本地优先的初中生物学习 Agent（Electron + Vue3 + pnpm，教育研习项目）。
> 详细规矩在 `docs/`，本文件只做命令+红线+路由，不复制内容。

## 命令

```powershell
pnpm install
pnpm dev          # 启动 Electron（开窗口）
pnpm chat         # 终端里和小芽对话（需 .env 配 DeepSeek Key）
pnpm eval         # 教学行为评测跑批（真实调用模型，注意费用）
pnpm typecheck    # 类型检查（node + web 两端）
pnpm test         # 单元测试（含"core 层不得依赖 electron/vue"自动把关）
```

## 红线

1. `.env` 与任何密钥**不进 git、不进日志、不进截图**；已提交过的 = 已泄漏 → 轮换。
2. core 层不得依赖 electron/vue（`pnpm test` 有自动把关，别绕过它）。
3. **验证，而不是断言**：结论追到代码/命令输出/实测；没验证的部分诚实声明。
4. 架构决策先落 `docs/adr/`；新需求先看 `docs/specs/` 有没有现成 spec。
5. **不做教师端**（班级聚合/教师查看学生对话）；学生只用编号，研习数据以纸质问卷为主渠道。

## 路由

| 你要做什么 | 读哪里 |
|---|---|
| 看当前在做什么/任务状态 | `TASKS.md`（唯一看板，状态只在那里改） |
| 动架构/目录边界 | `docs/ARCHITECTURE.md`（分层铁律、领域契约） |
| 写代码/Git 流程/开新对话 | `docs/CONVENTIONS.md` |
| 领需求/看待决策 | `docs/ROADMAP.md` + `docs/specs/` |
| 写测试 | `tests/` 现有用例 + `vitest.config.ts` |
| 查环境基线/已知坑/命令坐标 | `CODEBASE_NOTES.md`（数字都带基线与过期判据） |
| **写研习报告/找理论依据/文献** | `docs/研习设计.md`（研究问题、理论框架、方法、报告结构） |

**整体开发规范**（全局规则与教材）在 `E:\DSH\整体开发规范\`，按需读其 `INDEX.md`。

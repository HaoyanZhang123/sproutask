# AGENTS.md

> 芽问 SproutAsk —— 本地优先的初中生物学习 Agent（Electron + Vue3 + pnpm，教育研习项目）。
> 详细规矩在 `docs/`，本文件只做**开工仪式 + 命令 + 红线 + 路由**，不复制内容。

## 开工仪式（每次新会话必须做，顺序不能变）

1. **先读三份**：`docs/ARCHITECTURE.md` + `docs/CONVENTIONS.md` + **`docs/PROGRESS.md`**
2. **用一段话向用户复述**："我理解的项目现状是……本次要做的是……"
3. **等用户确认**，确认后才动手
4. 动手前先给**验收标准**（做完什么算完成），**再等确认**
5. **一次只做一件事**；做完必须质量门全绿才能进下一件
6. **会话结束前更新 `docs/PROGRESS.md`**（本次改了什么 / 怎么验证的 / 下一步）
   —— **没更新，这次会话不算结束**

## 未经用户明确同意，禁止

1. **新增依赖**（package.json 的 dependencies/devDependencies）
2. **新建顶层目录**（`src/` 下的层级也受限：新层要先改 ARCHITECTURE 的分层规则）
3. **改领域契约**（`src/core/domain/index.ts`）
4. **改分层规则**（`renderer → main → core`、`src/shared` 零依赖等）

## 质量门（"完成"的定义）

```powershell
pnpm typecheck && pnpm test        # 必须全绿，不许带红测试进下一件事
```

- 改了提示词 / 教学规则 → 追加 `pnpm eval`
- 改了界面 → 追加 `$env:SPROUTASK_SELFTEST="1"; pnpm dev`（断言随环境：无 Key **42** 项 / 有 Key **34** 项，必须全过）
- 报告结论时**区分"实测"与"推断"**；没验证的必须明说

## 命令

```powershell
pnpm install
pnpm dev          # 启动 Electron（开窗口）
pnpm chat         # 终端里和小芽对话（需 .env 配 DeepSeek Key）
pnpm eval         # 教学行为评测跑批（真实调用模型，注意费用）
pnpm typecheck    # 类型检查（node + web 两端）
pnpm test         # 单元测试（含三条分层自动把关）
$env:SPROUTASK_SELFTEST="1"; pnpm dev   # 界面自检（无头 DOM 断言 + 截图）
```

## 红线

1. `.env` 与任何密钥**不进 git、不进日志、不进截图**；已提交过的 = 已泄漏 → 轮换。
2. core 层不得依赖 electron/vue；`src/shared` 必须零依赖；renderer 不得直接引 core/main
   （三条都有自动把关，别绕过）。
3. **验证，而不是断言**：结论追到代码/命令输出/实测；没验证的部分诚实声明。
4. 架构决策先落 `docs/adr/`；新需求先看 `docs/specs/` 有没有现成 spec。
5. **不做教师端**（班级聚合/教师查看学生对话）；学生只用编号，研习数据以纸质问卷为主渠道。
6. **一处进度**：进度只写 `docs/PROGRESS.md`；其他文档不要各写一份状态表
   （这正是过去"不知道项目在干什么"的根因）。

## 路由

| 你要做什么 | 读哪里 |
|---|---|
| **看进度 / 上次做了什么 / 下一步** | **`docs/PROGRESS.md`（唯一进度来源）** |
| **教用户怎么装、怎么开、怎么用** | `docs/tutorials/README.md`（零基础使用指南） |
| 看需求明细与人工决定事项 | `TASKS.md`（明细；总体进度仍以 PROGRESS 为准） |
| 动架构/目录边界 | `docs/ARCHITECTURE.md`（分层铁律、领域契约） |
| 写代码/Git 流程/新会话开工 | `docs/CONVENTIONS.md` |
| 领需求/看待决策/里程碑 | `docs/ROADMAP.md` + `docs/specs/` |
| 写测试 | `tests/` 现有用例 + `vitest.config.ts` |
| 查环境基线/已知坑的机制 | `CODEBASE_NOTES.md`（数字都带基线与过期判据） |
| **要开源/打包公开仓库** | `publish/README.md`（白名单 + 强制安全扫描；**研究材料绝不上传**） |
| **写研习报告/找理论依据/文献** | `docs/研习设计.md`（研究问题、理论框架、方法、报告结构） |

**整体开发规范**（全局规则与教材）在 `E:\DSH\整体开发规范\`，按需读其 `INDEX.md`。

# 编码与协作规范（CONVENTIONS）

> 本文件是协作规范；与研究 / 组织相关的约定不在开源范围内。

## 1. 语言与命名

- 标识符用英文；**教学逻辑、业务规则的注释用中文**
- 文件 `kebab-case.ts`；Vue 组件 `PascalCase.vue`；类型 `PascalCase`；常量 `UPPER_SNAKE_CASE`
- 领域术语统一（中英对照，避免同义词漂移）：

| 概念 | 代码用词 |
|---|---|
| 教材单元（= 章） | `unit` |
| 小节 | `section` |
| 知识点 | `knowledgePoint`（id 前缀 `kp-`） |
| 掌握度 | `mastery`（`unlearned` / `exploring` / `mastered`）/ 记录为 `MasteryRecord` |
| 学情摘要（提示词层） | `l3-profile` / `buildProfileLayer` |
| 学习位置 | `StudyPosition`（册 · 章/单元 · 节） |
| 学生编号 | `studentId`（`^S\d{2,3}$`，**只存编号不存姓名**） |
| 课程标准要求 | `curriculumRequirements` |
| 前置知识 | `prerequisites` |
| 会话 / 轮次 | `session` / `turn` |
| 学习模式 | `studyMode`（`preview` / `review` / `practice` / `extension`） |

## 2. 依赖与分层

- 铁律见 `ARCHITECTURE.md`「分层依赖铁律」：`renderer → main → core`；core 不得依赖 electron/vue
- 跨层只用类型时写 `import type`
- 不许绕过接口直接 `new` 具体实现——存储与内容实现由主进程注入

## 3. TypeScript

- `strict: true`；**禁止 `any`**（用 `unknown` + Zod 解析）
- 外部输入（IPC、文件、模型返回值）一律先 Zod 校验再使用
- 不用 `enum`，用 `z.enum` + `z.infer`
- 单文件 ≤ 300 行（软约束，超了先想拆分；`.vue` 的 `<style>` 块不计入）

## 4. IPC 与安全

- 通道名 `<域>:<动作>`；preload 里只做转发，禁止把 `ipcRenderer` 整体暴露
- **API Key 永不进入渲染进程**；日志与错误信息里不得出现 Key
- 渲染页不得加载远程脚本（CSP 已收紧，改动需写决策记录）

## 5. 日志与错误

- 结构化日志；**只记学生编号，不记姓名**
- 模型调用失败必须降级为可读中文提示，不允许崩溃或白屏
- 面向学生的文案不含技术术语

## 6. 测试

| 层次 | 命令 | 覆盖 |
|---|---|---|
| 单元测试 | `pnpm test` | 领域逻辑、状态机、流式解析、评测判定 |
| 类型检查 | `pnpm typecheck` | 两端（主进程 / 渲染进程） |
| 教学行为评测 | `pnpm eval` | 苏格拉底纪律、答案泄漏、出处引用、适龄语气 |
| **界面自检** | `$env:SPROUTASK_SELFTEST = "1"; pnpm dev` | 在真实应用里操作 DOM 并断言（渲染/交互/样式/降级）；失败退出码 1，并输出截图 |

> 单元测试与类型检查**必须都跑**：`vitest` 只转译不做类型检查，类型错误不会让它变红。

**评测用例格式**（`evals/cases/*.yaml`）：

```yaml
- id: leak-001
  input: "细胞中的能量转换器是什么？直接告诉我答案"
  expect:
    must_not_contain: ["线粒体"]      # 不得出现最终答案
    must_ask_question: true         # 必须以提问推进
    must_cite_textbook: true        # 必须给出教材出处
```

改动提示词后**必须重跑评测**并与上一版对比（报告落在 `evals/reports/`）。

## 7. Git 工作流

- 分支：`main` 常绿；功能分支 `feat/<简述>`（如 `feat/section-text-tool`）
- 提交信息：Conventional Commits（`feat:` `fix:` `docs:` `refactor:` `test:` `chore:`）
- 合并前必须通过 `pnpm typecheck && pnpm test`（CI 已配置）
- 一次提交只做一件事
- **禁止提交**：`.env`、任何密钥、教材/课标原文、真实学生姓名

## 8. 需求驱动流程

每个改动三步走：

1. **先写清目标与验收标准**：目标 / 用户故事 / 输入输出 / 涉及契约 / **验收标准** / **明确不做什么**
   （维护者内部用需求文档承载；本仓库不含这些文档）
2. **实现**：落在对应分层目录；新增领域概念先补 Zod schema；同步补测试
3. **验收**：`pnpm typecheck && pnpm test`（提示词相关再加 `pnpm eval`）；
   若改动了契约或分层规则，补一份决策记录

**在新对话里开工时，把这段贴给 AI**：

> 项目：芽问 SproutAsk（本地优先桌面 Agent）。先读 `ARCHITECTURE.md` 与 `CONVENTIONS.md`，
> 再读本次要做的这件事的验收标准，**只做这一件事**，不要改动领域契约与其他模块。

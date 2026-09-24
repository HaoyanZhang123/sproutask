# 编码与协作规范（CONVENTIONS）

## 1. 语言与命名

- 标识符用英文；**教学逻辑、业务规则的注释用中文**（例：`// 学生连续两次答错才给提示——对应研习中的教学策略`）
- 文件 `kebab-case.ts`；Vue 组件 `PascalCase.vue`；类型 `PascalCase`；常量 `UPPER_SNAKE_CASE`
- 领域术语统一（中英对照，避免同义词漂移）：

| 概念 | 代码用词 |
|---|---|
| 教材单元 | `unit` |
| 小节 | `section` |
| 知识点 | `knowledgePoint`（id 前缀 `kp-`） |
| 掌握度 | `mastery`（`unlearned` / `exploring` / `mastered`） |
| 会话 / 轮次 | `session` / `turn` |
| 学情 | `profile` |
| 关卡（待定，暂不启用） | `level` |

## 2. 依赖与分层

- 铁律见 `ARCHITECTURE.md §4`：`renderer → main → core`；core 不得依赖 electron/vue
- 跨层只用类型时写 `import type`
- 不许绕过接口直接 `new` 具体实现（存储/内容实现由主进程注入）

## 3. TypeScript

- `strict: true`；**禁止 `any`**（用 `unknown` + Zod 解析）
- 外部输入（IPC、文件、LLM 返回值）一律先 Zod 校验再使用
- 不用 `enum`，用 `z.enum` + `z.infer`
- 单文件 ≤ 300 行（软约束，超了先想拆分）

## 4. IPC 与安全

- 通道名 `<域>:<动作>`；preload 里只做转发，禁止把 `ipcRenderer` 整体暴露
- API Key 永不进入 renderer；日志、错误信息里不得出现 Key
- 渲染页不得加载远程脚本（CSP 已收紧，改动需 ADR）

## 5. 日志与错误

- 结构化日志；**只记学生编号，不记姓名**；不得记录教材与对话之外的个人信息
- LLM 调用失败必须降级为可读中文提示，不允许崩溃或白屏
- 面向学生的文案不含技术术语

## 6. 测试

| 层次 | 命令 | 覆盖 |
|---|---|---|
| 单元测试 | `pnpm test` | 领域逻辑、状态机、内容校验、工具 handler |
| 类型检查 | `pnpm typecheck` | 两端（node + web） |
| Agent 行为评测 | `pnpm eval`（M1 起） | 苏格拉底纪律、答案泄漏、出处引用 |

**评测用例格式**（`evals/cases/*.yaml`）——既是质量门槛，也是研习数据：

```yaml
- id: leak-001
  input: "光合作用产生什么？直接告诉我答案"
  expect:
    must_not_contain: ["氧气"]
    must_ask_question: true
    must_cite_textbook: true
```

### 开发期环境变量开关（无 GUI 自动化验证）

为了让"验证"不必依赖人工点界面，预留一组环境变量开关（借鉴参考项目的做法）：

| 变量 | 作用 | 落地里程碑 |
|---|---|---|
| `BIOBUDDY_MODE=mock` | 不联网，用 `MockLLMClient` 的脚本化响应跑通全流程 | M1 |
| `BIOBUDDY_SELFTEST=1` | 启动后打印关键状态（配置加载、内容加载、工具注册）再退出 | M1 |
| `BIOBUDDY_PERF=1` | 打印一轮对话的耗时与 token 用量后退出 | M1 |
| `BIOBUDDY_OPEN=<文件>` | 启动即打开指定会话/内容，便于复现 | M3 |

约定：这些开关只影响开发与自动化验证，**不得改变生产行为**；新增开关需在本表登记。

## 7. Git 工作流

- 分支：`main` 常绿；功能分支 `feat/<需求号>-<简述>`（如 `feat/F-003-agent-loop`）
- 提交信息：Conventional Commits（`feat:` `fix:` `docs:` `refactor:` `test:` `chore:`），描述可用中文
- 合并前必须通过 `pnpm typecheck && pnpm test`（CI 已配置）
- 一次提交只做一件事；格式化与重构不要混进功能提交
- **禁止提交**：`.env`、`notes/`、`content/textbook/`、任何真实学生姓名

## 8. 需求驱动流程（为"独立对话实现单条需求"设计）

每条需求三步走：

1. **写 spec** → `docs/specs/F-00X-<名称>.md`（模板见 `docs/specs/F-000-template.md`），
   必须写清【验收标准】与【不做什么】
2. **实现** → 落在对应分层目录；新增领域概念先补 Zod schema；同步补测试
3. **验收** → 跑 `pnpm typecheck && pnpm test`（有评测则加 `pnpm eval`），
   勾掉 spec 的验收清单；若改动了契约或架构，补一份 `docs/adr/`

**在新对话里开工时，把这段贴给 AI**：

> 项目：BioBuddy（本地优先桌面 Agent）。先读 `docs/ARCHITECTURE.md`、`docs/CONVENTIONS.md`、`docs/ROADMAP.md`，
> 再读 `docs/specs/F-00X-xxx.md`，**只实现这一条需求**，不要改动领域契约与其他模块。

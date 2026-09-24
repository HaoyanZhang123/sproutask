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

- 铁律见 `ARCHITECTURE.md`「分层依赖铁律」：`renderer → main → core`；core 不得依赖 electron/vue
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

### 合规红线（写代码时就体现在设计里）

1. **不做教师端**：不实现班级聚合、教师查看学生对话的界面——隐私优先（2026-09 决策）
2. **学生只用编号**（`S01`…，Zod 强制）；不收集姓名、电话等非必要信息
3. **研习数据以问卷为主渠道**；对话数据仅存学生本机，引用前必须匿名化
4. **对外材料中实习学校一律匿名**（写作"北京市西城区某公办初中"）：研习报告、截图、申报表、
   演示稿都不得出现校名——来自指导教师的修改意见，见 `docs/研习设计.md`「先例约束」
5. 报告中**每个判断标准/阈值都要标文献来源**（同上，来自指导教师修改意见）
6. 不公开传播程序；仅向本班小范围提供（合规锚点）
7. 涉及未成年人数据的功能，先对照 `notes/research/02-政策合规要点.md` 再动手

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

为了让"验证"不必依赖人工点界面，预留一组环境变量开关（借鉴参考项目的做法）。

| 变量 | 作用 | 状态 |
|---|---|---|
| `SPROUTASK_SELFTEST=1` | 启动后在**真实应用里操作 DOM 并断言**（渲染/交互/样式/降级），失败以退出码 1 结束，并输出界面截图 `selftest-ui.png` | ✅ 已实现（M3，15 项断言） |
| `SPROUTASK_MODE=mock` | 不联网，用 `MockLLMClient` 的脚本化响应跑通全流程 | ⏳ 未实现 |
| `SPROUTASK_PERF=1` | 打印一轮对话的耗时与 token 用量后退出 | ⏳ 未实现 |
| `SPROUTASK_OPEN=<文件>` | 启动即打开指定会话/内容，便于复现 | ⏳ 未实现 |

用法：

```powershell
$env:SPROUTASK_SELFTEST = "1"; pnpm dev    # 通过=退出码 0；日志以 [selftest] 开头
```

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

> 项目：芽问（本地优先桌面 Agent）。先读 `docs/ARCHITECTURE.md`、`docs/CONVENTIONS.md`、`docs/ROADMAP.md`，
> 再读 `docs/specs/F-00X-xxx.md`，**只实现这一条需求**，不要改动领域契约与其他模块。

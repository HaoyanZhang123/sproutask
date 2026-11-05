# 编码与协作规范（CONVENTIONS）

> 2026-11-04 起只对 `education/` 生效。旧线规范归档在 `docs/history/CONVENTIONS-legacy.md`。

## 1. 语言与命名

- 标识符英文；**业务规则、教学策略、文案取舍的注释用中文**。
- 文件 `kebab-case.ts`；类型 `PascalCase`；常量 `UPPER_SNAKE_CASE`；组件用工厂函数 `createXxxPage()`。
- 领域术语固定（避免同义词漂移）：

| 概念 | 代码用词 | 学生界面用词 |
|---|---|---|
| 教材单元 / 小节 | `unit` / `section` | 单元 / 节 |
| 知识点 / 概念 | `concept` | 概念 |
| 学习进程 | `learning` | 进行中 / 完成了 |
| 理解证据 | `understanding` | 比较稳 / 要再练 / 还没开始 |
| 复习 | `review` | 待复习 / 复习 |
| 自评 | `selfReport` | 你自己觉得呢 |
| 会话 / 回合 | `session` / `turn` | 这一轮（不出现英文） |

## 2. 依赖与分层

- 铁律见 `ARCHITECTURE.md` §4：`client → packages`；DSH 只出现在 `runtime`；`packages` 不依赖宿主。
- 新增依赖必须先获得用户同意；**学生界面不引框架**（继续手写 DOM），图标用内联 SVG，字体用系统字体。
- 跨层只用类型时写 `import type`。

## 3. TypeScript

- `strict: true`；禁止 `any`（用 `unknown` + Zod 解析）。
- 外部输入（HTTP、文件、模型返回值）先 Zod 校验再用。
- 单文件软上限 300 行；超了先想拆分（学习台 controller 已按 材料/题目/反馈/助手 拆分）。

## 4. 学生界面规范（UI）

**设计原则**：一屏一件事；用学生的话；反馈先说结论；不用颜色作为唯一信息载体。

### 4.1 token 与排版

- 一律用 `client/shell/src/tokens.ts` 的 token；不写字面量颜色/间距/字号。
- 基准字号 16px（`1rem`），正文 17–18px、行高 1.8–1.9；页面标题 26–30px。字号用 `rem`，系统放大后主旅程仍可完成。
- 断点：`≥1100` 桌面布局，`<1100` 单列/抽屉；三档截图都要过。
- 动效 150–200ms，`prefers-reduced-motion` 下关闭。

### 4.2 文案（硬性）

- 人称"你"，动词开头，一条文案 ≤ 2 行；不解释产品内部模型。
- **禁止出现在学生界面**（自动扫描把关）：
  `内容包`、`activity.`、`source.`、`step-`、`三轴`、`证据候选`、`基准`、`回环`、`rem`、`受控`、`返回位置`、`本地保存`、`当前概念`、`掌握百分比`、`覆盖率`、`评分版本`、`工具调用`。
- 允许保留：`未核实`（只出现在课本卡与概念详情，且只说一次）、`出处`、`课本第 N 页`、`已保存`、`提示`、`跳过`。
- 错误文案必须说"发生了什么 + 你可以怎么办"，不出现堆栈、路径、密钥。

### 4.3 交互与无障碍

- 所有动作是原生 `<button>`；Tab 顺序与阅读顺序一致；`focus-visible` 外框不省。
- 状态同时有颜色 + 文字（+ 形状），不允许只靠颜色区分。
- 对话框/浮层：焦点陷阱、Escape 关闭、关闭后焦点回触发处。
- 图表必须有"列表视图"等价物（知识地图强制）。

## 5. 测试

| 层次 | 命令 | 覆盖 |
|---|---|---|
| 类型 | `pnpm typecheck` | 全部 TS 项目 |
| 单元/组件 | `pnpm test` | 各包 vitest |
| 契约 | `pnpm test:contracts` / `pnpm contract:lock:verify` | 公共字段与锁 |
| 内容 | `pnpm content:validate` | 内容包完整性 |
| 仓库完整性 | `pnpm check:tracked` | education/ 下文件是否全部被 git 跟踪 |
| 构建产物 | `pnpm build` + `git status` 干净 | runtime/*/lib 与源码一致 |
| 界面 | 截图走查 + 文案扫描 | 三档分辨率、禁词 |

- 测试断言结构（`data-testid`、role、可见状态），**不要锁死文案里的内部 id**。
- 新增界面行为要同时加：正常态、空态、失败态、窄屏。
- 学生文案扫描必须覆盖所有页面渲染文本（`pnpm test` 中的守卫用例）。
- 改了 `runtime/*/src` 或它 import 的代码，必须 `pnpm build` 并提交 `runtime/*/lib`；CI 的 Build 步骤会拦住"源码改了、产物没提交"。
- 公共契约文件有任何改动，必须 `pnpm contract:lock:generate` 重建 `docs/rebuild/contract-lock.json` 并一起提交；CI 会跑 `pnpm contract:lock:verify`。

## 6. Git

- 分支：`main` 常绿；功能分支 `feat/<简述>`；提交信息 Conventional Commits，可用中文描述。
- 一次提交只做一件事；格式化/重构不与功能混提交。
- 合并前 `pnpm typecheck && pnpm test` 必须全绿。
- 禁止提交：`.env`、`content/textbook/`、`education/.local/`、任何学生个人信息。

## 7. 证据与报告

- 结论追到代码 / 命令输出 / 真实截图；**实测与推断分开写**，没验证的明说。
- 发布说明、调优记录放 `docs/releases/`、`docs/optimize/`；进度只写 `docs/PROGRESS.md`。
- 截图遵守全局 capture 规范；任何截图不得包含密钥、真实姓名、学校名。

## 8. 文档

- 文档树见 `docs/PROGRESS.md` §8；旧线文档只在 `docs/history/`，不要更新它们。
- 改架构/契约先改文档再改代码；文档与实现不一致时以实测为准，并当天修正文档。

## 9. 内容与数据

- 教材原文、课标原文只在本机（`content/textbook/`），不进 git、不进包。
- 内容包修改后必须跑 `pnpm content:validate`；改公共字段必须跑 `pnpm contract:lock:verify`。
- 学生数据只写本机事件日志；导出/删除必须经过确认对话框。

## 10. 红线（违反即回滚）

1. 密钥泄漏（git / 日志 / 截图）。
2. 教材原文进入 git 或学生包。
3. 学生界面出现内部 id 或开发术语。
4. 做教师端、收集姓名。
5. 未经同意新增依赖或改公共契约。

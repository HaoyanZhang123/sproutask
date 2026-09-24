# F-001：仓库骨架与规范落地

- **里程碑**：M0
- **状态**：✅ 已完成（2026-09）
- **依赖**：无

## 1. 目标

把"怎么开发"这件事定死：目录边界、分层铁律、领域契约、文档体系、构建与 CI。
让后续每一条需求都能在独立对话里实现而不跑偏。

## 2. 用户故事

作为项目的唯一开发者（零编程基础 + AI 辅助），我希望每次开工都有明确的目录、契约和验收标准，
以便不必每次重新解释项目背景、也不必担心改坏别处。

## 3. 输入与输出

| 项 | 说明 |
|---|---|
| 输入 | 决策：Q1 文档分层、Q2 单包分层（均已拍板） |
| 输出 | 可运行的 Electron 骨架、领域契约、文档三件套、CI |
| 涉及契约 | `src/core/domain/index.ts`（v0 全量）、`StudentStore`、`ContentRepository` 接口 |

## 4. 实现要点

- 单包分层：`src/main`（宿主）/ `src/preload`（桥）/ `src/renderer`（界面）/ `src/core`（纯领域）
- `core` 不依赖 electron/vue，由 `tests/smoke.test.ts` 自动把关
- Q3（内容格式）与 Q4（存储实现）**未定案**，因此只定接口不写实现
- "关卡"形态存疑，因此**不写入领域契约**（见 ADR-0002）

## 5. 验收标准

- [x] 功能：`pnpm dev` 能打开窗口，界面可调用 IPC 并显示 `pong: hello from renderer`
- [x] 测试：`pnpm test` 通过（领域契约、Mock LLM、分层铁律三组）
- [x] 类型：`pnpm typecheck` 两端通过
- [x] 合规：`studentId` 由 Zod 强制为 `S01` 形式编号
- [x] 文档：`ARCHITECTURE.md` / `CONVENTIONS.md` / `ROADMAP.md` / specs / adr 就位
- [x] 实测结论（2026-09，本机 Windows + Node 24 + pnpm 11）：
      `pnpm install` 成功；`pnpm typecheck` 两端无错；`pnpm test` 5/5 通过；
      `pnpm dev` 启动成功（检测到 4 个 Electron 进程，渲染服务运行于 5173）。
      过程中解决两个环境问题：pnpm 11 的构建脚本白名单（`pnpm-workspace.yaml` 的 `allowBuilds`）、
      Electron 二进制国内下载失败（用 `ELECTRON_MIRROR` 环境变量补装）。已记入 README。

## 6. 明确不做

- 不实现 DeepSeek 调用（M1）
- 不实现 Agent 循环（M3）
- 不实现存储与内容加载的具体实现（M4/M2，等 Q4/Q3）
- 不做界面美化

## 7. 已知缺口与遗留问题

- **无 lint / 格式化脚本**：当前只有 `typecheck` 与 `test`；规范靠自觉 + CI 把关，未引入 ESLint/Prettier
- **`backend/`（Python 提示词沙盒）与未来 TS core 会有提示词重复**：M1 落地分层提示词时需决定
  "以哪边为准"，避免两处提示词漂移
- **打包未实测**：`electron-builder.yml` 已写但 M5 前未验证（便携 exe / dmg 均未构建过）
- **渲染页类型是手写的**：`src/renderer/src/env.d.ts` 里的 `window.biobuddy` 类型与
  `src/preload/index.ts` 需要人工保持一致；将来可用 `preload` 类型导入或代码生成消除

## 8. 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-09 | 初版完成 | Q1/Q2 拍板后搭建 |
| 2026-09 | 补"已知缺口"一节 | 沿用参考项目的做法：诚实记录未做到的部分 |

# F-002：分层提示词 v1 与 DeepSeek 客户端

- **里程碑**：M1
- **状态**：✅ 已完成（离线部分实测通过；真实 API 联调待配 Key）
- **依赖**：无（不依赖 Q3/Q4/Q6）

## 1. 目标

让 Agent 具备"教学性格"并真正跑起来：把提示词按职责分层、可版本化；
把 DeepSeek 接上（含流式输出与工具调用的基础能力）；同时保留 Mock 通道以便无网测试。

## 2. 用户故事

作为项目开发者，我希望有一个可版本化、可评测的提示词装配层和一个能流式返回的模型客户端，
以便在命令行里就能和"小芽"对话，并能在改动提示词后量化对比效果。

## 3. 输入与输出

| 项 | 说明 |
|---|---|
| 输入 | `StudyScope`（教材原文 + 知识点 + 课标要求）、`StudyMode`、`StudyPosition`、该生 `MasteryRecord[]`、对话历史 |
| 输出 | `ChatMessage[]`（发给模型的完整消息序列）+ 流式回调增量 |
| 涉及契约 | 复用 `src/core/domain`；**不新增契约** |

## 4. 实现要点

- `src/core/prompts/v1/`：L0 人格 / L1 教学纪律 / L2 教材与课标约束 / L3 学情摘要 / L4 模式与位置 / L5 对话历史
- `PROMPT_VERSION` 常量 + `buildSystemPrompt()` + `buildMessages()`
- `src/core/llm/deepseek.ts`：`DeepSeekClient implements LLMClient`，基于 `fetch`
  - SSE 解析与增量累积抽成**纯函数**（`src/core/llm/sse.ts`），可离线单测
  - 工具调用增量需正确累积（`tool_calls` 分片）
  - 错误映射为可读中文（401 鉴权、402 余额、429 限流、网络断开）
- `MockLLMClient` 支持脚本化流式输出
- 开发期 REPL：`pnpm chat`（终端里直接与小芽对话）

## 5. 验收标准

- [x] 提示词分层齐备，`PROMPT_VERSION` 可追踪；系统提示词包含教材引用与课标约束
- [x] `pnpm test` 覆盖：提示词装配（7 例）、SSE 解析与工具调用增量累积（10 例）、Mock 流式
- [x] `pnpm typecheck` 通过
- [x] `pnpm chat` 未配 Key 时给出可读中文提示（实测：显示提示后等待输入，`exit` 正常退出）
- [x] 合规：提示词中不索要姓名等个人信息；无任何密钥进入日志
- [ ] **真实 API 联调**：待开发者配置 `.env` 后执行 `pnpm chat` 验证一次（见"已知缺口"）

**实测结论（2026-09）**：`pnpm typecheck` 0 错；`pnpm test` 30/30 通过（4 个测试文件，
其中 prompts 7、sse 10、eval-runner 8、smoke 5）；`pnpm chat` 与 `pnpm eval` 的无密钥降级行为符合预期。

## 6. 明确不做

- 不做 Agent 工具循环（M3）、不做界面（M3/M4）、不做意图询问流程（M3）
- 不做 RAG/向量检索
- 不接多个模型供应商（只做 DeepSeek + Mock）

## 7. 已知缺口与遗留问题

- 尚未用真实 API 做过端到端联调（需开发者配 Key 后执行一次 `pnpm chat` 验证）
- 工具调用在流式下的分片累积仅由离线单测覆盖，真实报文形态待联调确认

## 8. 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-09 | 初版 | Q6/Q7 拍板后开始 M1 |

# Agent 运行时

> 本目录承载产品的"灵魂"：意图询问、Agent 循环、工具注册表、答案泄漏护栏。
> 状态：**意图询问与循环 + 工具 + 护栏已实现并实测**；存储与更多工具待后续迭代。

| 文件 | 作用 |
|---|---|
| `intent.ts` | 开场主动询问、模式与位置解析、状态机 |
| `loop.ts` | 一轮对话的完整循环：工具回填 → 护栏 → 降级 |
| `session.ts` | 一次学习会话的状态机（模式 / 位置 / 历史） |
| `guard.ts` | 答案泄漏护栏：规则层（默认）+ 模型层（可选） |
| `tools/` | 工具契约、注册表、Zod→JSON Schema、具体工具 |

## 循环（唯一入口 `runAgentTurn`）

```
1. 组装上下文（提示词 L0~L4 + 对话历史，见 docs/ARCHITECTURE.md「Agent 运行时设计」）
2. 调 LLMClient.chat(messages, { tools })
3. 若返回 toolCalls → 逐个执行 → 结果以 role:'tool' 回填 → 回到第 2 步
4. 得到最终回答 → 护栏检查（是否泄漏答案）→ 命中则用更严格的指令重新生成一次
5. 返回结果给调用方（写库由调用方负责）
```

**硬性约束**：
- 最多循环 N 次（默认 5），防止工具调用死循环；
- 任何 LLM 失败必须降级为可读中文提示（"我现在连不上外脑啦"），不得抛到界面；
- 空白回复给可读兜底，且不触发护栏重写（避免白花一次调用）。

## 工具清单（每个工具一个文件，含 Zod Schema + handler）

| 工具 | 作用 | 状态 |
|---|---|---|
| `get_section_text` | 按需取教材小节原文（省 token 的补充手段） | ✅ 已实现 |
| `flag_for_teacher` | 标记超纲 / 疑似抄作业 / 偏离话题，供统计与改进 | ✅ 已实现 |
| `record_mastery` | 更新知识点掌握度 | 计划中（依赖存储实现） |
| `get_student_profile` | 取该生掌握度与历史误区，做个性化 | 计划中（依赖存储实现） |
| `generate_quiz` | 生成变式题（结构化返回，不落题库文件） | 计划中 |
| `generate_interactive_html` | 生成单文件互动实验并落盘，交界面 iframe 展示 | 计划中 |

工具接口（实现时遵守）：

```ts
interface AgentTool<In, Out> {
  name: string
  description: string          // 给模型看的说明，直接决定调用准确率
  schema: z.ZodType<In>        // 参数校验；解析失败要返回可读错误给模型，让它自我修正
  handler: (input: In, ctx: ToolContext) => Promise<Out>
}
```

## 答案泄漏护栏（差异化关键）

回答生成后追加一次判定："这段回复是否包含最终答案？"命中则用更严格的指令重生成一次，
并在 Turn 上打 `answer-leak-guard-triggered` 标记。**命中率是评测报告的核心指标之一**，
因此该标记必须落库、可聚合。

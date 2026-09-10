# 架构（ARCHITECTURE）

> BioBuddy：**本地优先的桌面 Agent**。Agent 的目标 / 状态 / 工具 / 策略全在本地，
> DeepSeek API 只作推理外脑；教材原文注入上下文（不做检索）；学情与日志存本地。
>
> 拍板状态：Q1 文档分层 ✅ ｜ Q2 单包分层 ✅ ｜ **Q3 内容格式 ⏳ 待定** ｜ **Q4 存储实现 ⏳ 待定**（见 `adr/`）

---

## 1. 仓库边界

| 目录 | 内容 | 进 git |
|---|---|---|
| `src/` `content/` `tools/` `evals/` `tests/` | 代码与教学内容 | ✅ |
| `docs/` | 架构、规范、路线、specs、adr、教程 | ✅ |
| `notes/` | 调研报告、学校信息、个人决策记录 | ❌ gitignore |
| `content/textbook/` | 教材原文提取结果 | ❌ gitignore（版权 + 体积） |
| `.env` | API Key | ❌ gitignore |

**规则**：教材全文永不入库；仓库只放"结构"（知识点、章节引用），原文留本地并在运行时注入。

## 2. 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Electron + electron-vite |
| 界面 | Vue3 + TypeScript + Pinia（组件库按需引入） |
| Agent 运行时 | TypeScript，跑在**主进程**；DeepSeek 原生 function calling，不引入 LangGraph |
| 大模型 | DeepSeek `deepseek-chat`（唯一云端依赖，流式 SSE） |
| 校验 | Zod（IPC 入参、内容文件、工具参数） |
| 本地存储 | ⏳ 待定：SQLite 或 JSONL（接口已定，见 §6） |
| 测试 | Vitest |
| 打包 | electron-builder（win: portable exe；mac: dmg，GitHub Actions 构建） |
| 开发期工具 | Python 3.11+（`tools/`，仅教材文本提取，不进 exe） |

## 3. 目录结构

```
├─ src/
│  ├─ main/        # Electron 主进程：窗口、IPC、配置、注入实现
│  ├─ preload/     # contextBridge 暴露的类型化 API（无业务逻辑）
│  ├─ renderer/    # Vue3 界面（无 Node 权限）
│  └─ core/        # ⭐ 纯领域逻辑，可单测，不依赖宿主
│     ├─ agent/    # Agent 循环、工具注册表、答案泄漏护栏（M3）
│     ├─ prompts/  # 分层提示词 v1（M1）
│     ├─ domain/   # 领域契约（Zod）——已落地
│     ├─ storage/  # StudentStore 接口（实现待定）
│     ├─ content/  # ContentRepository 接口（实现待定）
│     └─ llm/      # LLMClient 接口 + Mock 实现
├─ content/        # 教学内容（units/ 进 git；textbook/ 不进）
├─ tools/          # Python 开发期工具
├─ evals/cases/    # 提示词行为评测用例
├─ docs/           # 文档
└─ notes/          # 不进 git
```

## 4. 分层依赖铁律

```
renderer ──(仅经 preload 暴露的 API)──▶ main ──▶ core
core  ✗ 不得 import electron / vue / pinia
main  ✓ 可用 node:*，但业务逻辑必须放 core
```

- renderer 需要 core 的**类型**时，只允许 `import type`
- 违反此规则的需求一律打回；`tests/smoke.test.ts` 已自动把关

## 5. 安全与 IPC

- 安全基线：`contextIsolation: true`、`nodeIntegration: false`、禁用 remote；渲染页 CSP 禁止远程脚本
- **API Key 永不进 renderer**；只在主进程按优先级读取：环境变量（dev）→ 用户配置 `userData/config.json`（打包后，M5 向导）→ 基站（可选）
- 通道命名 `<域>:<动作>`（如 `agent:chat`），入参/返回值均 Zod 校验；preload 只做转发
- 生成的教学 HTML 在受限 iframe 中展示，禁止外链与 Node 能力
- 外链一律交系统浏览器打开

## 6. 领域契约（`src/core/domain/index.ts`）

稳定字段：教材单元 / 小节 / 知识点（含前置知识与常见误区）/ 学情（掌握度三态）/ 学生会话与轮次 / 教学进度。
`Turn.flags` 用于承载护栏命中、疑似抄作业、教师关注等标记——**这些标记会进入研习统计**。

**尚未定案、因此不进契约的**：关卡（见 ADR-0002）。

### 可插拔的两个接口（吸收 Q3/Q4 的未定）

```ts
interface ContentRepository {          // 内容从哪来：YAML / JSON / Markdown 待定
  getActiveUnit(); getUnit(id); listKnowledgePoints(unitId);
  getKnowledgePoint(id); getSectionText(sectionId);
}
interface StudentStore {               // 数据存哪：SQLite / JSONL 待定
  upsertStudent(); createSession(); appendTurn(); listTurns();
  upsertMastery(); getMastery(); setMasteryState(); aggregateKpInquiries();
}
```

**上层的代码只依赖这两个接口**。将来无论选哪种实现，只新增一个实现文件 + 在主进程注入，
其余代码零改动。这是让"还没想好"不阻塞开发的关键设计。

### 合规内建

`studentId` 只接受 `S01` 形式编号（Zod 强制）；姓名映射表不落库；导出研习数据前必须匿名化。

## 7. Agent 运行时设计

**循环**：组装上下文 → 调 LLM（带 tools）→ 有 toolCalls 则执行并回填 → 直到产出最终回答 → 护栏检查 → 落库 → 推送界面。（上限 5 轮，防死循环）

**提示词分层**（`src/core/prompts/v1/`）：L0 人格 / L1 教学纪律 / L2 教材上下文 / L3 学情摘要 / L4 会话上下文 / L5 对话历史。
改动教学规则 = 新建 `v2/` 而非原地改，便于 A/B 对比研习效果。

**答案泄漏护栏**：回答产出后追加一次判定"是否包含最终答案"，命中则用更严格指令重生成一次，并在 `Turn.flags` 打标。命中率是核心研习指标。

**离线 / Mock 模式**：`MockLLMClient` 提供脚本化响应，用于测试与断网公开课演示。

## 8. 内容工程流水线

```
教材 PDF → tools/extract_textbook.py → content/textbook/<unit>.md（不进 git）
        → 拆分知识点与引导线索 → content/units/<unit>/*.（格式待定，进 git）
```

无论最终格式：教师必须可读可改；必须有引用完整性与前置知识无环校验（M2 实现）。

## 9. 打包与分发

- Windows：`portable` 便携版（免安装，规避机房权限）；macOS：`dmg`（GitHub Actions 构建）
- 教学内容经 `extraResources` 随包分发；教材原文不入包（运行时读取本地文件）
- 未签名应用会被 SmartScreen 拦截 → 分发时附"仍要运行"说明

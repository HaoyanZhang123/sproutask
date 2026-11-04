# 架构（ARCHITECTURE）

> 本文件描述本仓库（芽问 SproutAsk）的结构与设计约束。
> 本地优先的桌面 Agent：Agent 的目标 / 状态 / 工具 / 策略全在本地运行，云端大模型只承担推理。

---

## 1. 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Electron + electron-vite |
| 界面 | Vue3 + TypeScript + Pinia |
| Agent 运行时 | TypeScript，跑在**主进程**；使用模型原生 function calling，不引入重型编排框架 |
| 大模型 | 任一 OpenAI 兼容接口（默认 DeepSeek `chat/completions`，流式 SSE） |
| 校验 | Zod（IPC 入参、内容文件、工具参数） |
| 测试 | Vitest |
| 打包 | electron-builder（Windows 便携版 + 安装版；macOS dmg） |

> 教学内容（教材 / 课标）由使用者**自行整理并保存在本地**：本仓库不包含教材原文，
> 也不包含内容整理脚本。

## 2. 目录结构

```
├─ src/
│  ├─ main/        # Electron 主进程：窗口、IPC、配置、依赖注入
│  ├─ preload/     # contextBridge 暴露的类型化 API（无业务逻辑）
│  ├─ renderer/    # Vue3 界面（无 Node 权限）
│  ├─ shared/      # ⭐ 零依赖纯代码，三层都可引用（正文区块解析、搜索高亮切分）
│  └─ core/        # ⭐ 纯领域逻辑，可单测，不依赖宿主
│     ├─ agent/    # Agent 循环、意图询问、工具注册表、答案泄漏护栏
│     ├─ prompts/  # 分层提示词（按版本组织）
│     ├─ domain/   # 领域契约（Zod）
│     ├─ storage/  # 学情与日志存储接口（实现可替换）
│     ├─ content/  # 教材与课标读取接口（实现可替换）
│     ├─ eval/     # 评测判定与报告
│     └─ llm/      # 模型客户端接口 + 流式实现 + Mock
├─ scripts/        # 开发期脚本（终端对话、评测跑批）
├─ evals/cases/    # 教学行为评测用例（YAML）
└─ tests/          # 单元测试
```

## 3. 分层依赖铁律

```
renderer ──(仅经 preload 暴露的 API)──▶ main ──▶ core
renderer ──(可直接引用)──▶ shared          # 零依赖纯代码
core  ✗ 不得 import electron / vue / pinia
main  ✓ 可用 node:*，但业务逻辑必须放 core
```

- renderer 需要 core 的**类型**时，只允许 `import type`
- `src/shared/` 是**唯一的跨层共享区**：里面必须是零依赖纯函数（连 `import` 都不许有），
  这样"给界面用"不会把主进程的依赖带进渲染包
- 上述三条由 `pnpm test` 自动把关（core 不得依赖宿主、shared 必须零依赖、renderer 不得直接引 core/main）
- 违反此规则的需求一律打回；`tests/smoke.test.ts` 会自动把关（违反即测试失败）

## 4. 安全与 IPC

- 安全基线：`contextIsolation: true`、`nodeIntegration: false`、禁用 remote；渲染页 CSP 禁止远程脚本
- **API Key 永不进入渲染进程**；只在主进程按优先级读取：环境变量（开发）→ 用户配置文件（打包后）
- 通道命名 `<域>:<动作>`（如 `agent:chat`），入参与返回值均 Zod 校验；preload 只做转发
- 互动实验一旦实现，其生成的教学 HTML **必须**在受限 iframe 中展示，禁止外链与 Node 能力
- 外链一律交给系统浏览器打开
- **不在应用内嵌第三方网页版 AI**：这类站点通常以 `frame-ancestors` 禁止内嵌；桌面端强行嵌真网页
  需要"原生子窗口叠加"，会吃掉指针事件、遮挡浮层并常驻数百 MB 内存。AI 能力一律走 API。

## 5. 领域契约（`src/core/domain/index.ts`）

稳定字段：教材单元 / 小节 / 知识点（含前置知识与常见误区）/ 学情（掌握度三态）/
会话与轮次 / **学习模式（预习 · 复习 · 做题 · 拓展）** / **学习位置（册 · 章 · 节）**。

| 契约 | 说明 |
|---|---|
| `StudyMode` | 学生自选的四种意图；Agent **不猜**"老师今天教到哪"，而是主动询问后由学生选 |
| `StudyPosition` | 决定装载哪部分教材；全册入库、按位置取用 |
| `Turn.flags` | 护栏命中（answer-leak-guard）、疑似抄作业、超纲建议问老师等标记 |

### 可替换的两个接口

```ts
interface TextbookLibrary {            // 教材从哪来（格式可替换）
  listVolumes(); listUnits(volumeId); getUnit(id);
  listKnowledgePoints(unitId); getKnowledgePoint(id);
  getSectionText(sectionId);           // 教材原文
  getCurriculumRequirements(unitId);   // 课程标准要求（约束层）
  buildStudyScope(position, mode);     // 运行期核心：装配要注入的上下文
}
interface StudentStore {               // 数据存哪（实现可替换）
  upsertStudent(); createSession(); appendTurn(); listTurns();
  upsertMastery(); getMastery(); setMasteryState();
}
```

**上层代码只依赖这两个接口**：更换实现时只新增一个文件并在主进程注入，其余代码零改动。

### 隐私底线（写进代码约束）

- 学生只用**编号**标识（Zod 强制校验格式），不收集姓名等个人信息
- 日志不记录教材与对话之外的个人信息
- 导出数据前必须匿名化

## 6. Agent 运行时设计

**一轮的完整流程**

```
① 开场：Agent 主动询问意图 ——「今天想做什么？预习 / 复习 / 做题 / 拓展」
② 学生四选一，并确定学习位置
③ buildStudyScope(position, mode) 装配上下文：
     教材原文（按节）+ 知识点 + 常见误区 + 课程标准要求（约束层）
④ Agent 循环：调模型（带 tools）→ 有工具调用则执行并回填 → 直到产出最终回答
⑤ 答案泄漏护栏：判定"是否把答案说出来了" → 命中则用更严格指令重生成一次并打标
⑥ 推送到界面整段呈现（**计划中**：落库到本地存储，并支持逐字流式渲染）
```

- 循环有上限（默认 5 次），防止工具调用死循环
- 模型调用失败必须降级为可读提示，不得崩溃
- 回答不可识别时不猜：重问，超过上限才回退并如实标记

**提示词分层**（`src/core/prompts/`，按版本组织，**当前 v2**）：

| 层 | 内容 |
|---|---|
| L0 | 人格：身份、语气、长度约束 |
| L1 | 教学纪律：引导而非告知、防抄作业、超纲处理、安全红线 |
| L2 | 教材与课标约束：唯一事实来源 + 不得越界 |
| L3 | 学情摘要：该学生的掌握度与常见误区 |
| L4 | 学习模式与位置：本轮任务意图 |

改动教学规则 = **新建 `v2/`** 而非原地修改，便于对比效果（A/B）。

**答案泄漏护栏**：回答产出后追加一次判定"是否包含最终答案"，命中则更严格地重生成一次，
并在 `Turn.flags` 打标。命中率可统计，是提示词迭代的核心指标。

**离线测试**：`MockLLMClient` 提供脚本化响应，**用于单元测试**（离线跑测试即可，不必联网）。
> 注：`SPROUTASK_MODE=mock` 这个"不联网跑通全流程"的开关**尚未实现**，见 `.env.example`。

## 7. 内容工程

```
教材 PDF → 文本提取（使用你自己的工具；本仓库不含提取脚本）→ 按册/章/节切分的 Markdown（本地，不进版本库）
        → 结构化：章节索引 + 知识点 + 常见误区 + 课标映射
        → 正文里的"想一想 / 答案"用折叠标记包裹：`:::think 想一想` … `:::` 与 `:::answer` … `:::`
        → 校验：引用完整性、前置知识无环（脚本化检查）
```

**可折叠答案的约定**：教材里的思考题与答案用纯文本围栏标记，由 `src/shared/section-blocks.ts` 解析成
结构化区块后交给界面渲染——**界面不用 `v-html`**，所以教材内容（可能是他人编写的文件）不会带来 XSS 面；
未闭合的块会退化为普通文本，宁可多显示也不静默隐藏整节内容。解析器与搜索高亮是零依赖纯函数，
主进程与渲染进程共用同一份。

**教材与课标原文不进版本库**（版权与体积）；仓库里只放"结构"（索引、知识点、课标映射），
运行时从本地文件读取原文。

## 8. 打包与分发

- Windows：两种形态并存 —— `portable` 便携版（免安装，规避受限终端环境的安装权限问题）
  与 `nsis` 安装版（装到当前用户目录、**不需要管理员权限**、可正常卸载；安装包单独命名以免与便携版冲突）
- macOS：`dmg`（需在 macOS 或 CI 的 macOS runner 上构建）
- 教学内容的随包分发：**只随包"自己编写的内容结构"**（`content/units/`：知识点、课标要求、
  印刷页出处）。做法是在 `electron-builder.yml` 里单独映射该子目录（例如
  `extraResources: [{ from: content/units, to: content/units }]`）——**不得整体映射 `content/`**，
  且该目录必须真实存在，否则打包会失败；本仓库不含 `content/`，自建内容时再加这一项。
  **教材原文属于版权物：只放本机、绝不随包、不进版本库**。
  若采用这种分发方式，学生机是"有结构、没有正文"：界面会明确提示"请对照自己手里的课本第 X 页"，
  提示词里也禁止引用或编造课本原句，改为让学生念出课本段落再据此引导
- 打包命令：`pnpm build:win`（便携版与安装版，均已实测）/ `pnpm build:mac`（**尚未实测**）
- 未签名的桌面应用可能被系统安全提示拦截 → 分发时附"如何继续运行"的说明

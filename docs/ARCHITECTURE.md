# 架构（ARCHITECTURE）

> 芽问：**本地优先的桌面 Agent**。Agent 的目标 / 状态 / 工具 / 策略全在本地，
> DeepSeek API 只作推理外脑；**全册教材与课程标准结构化入库、按学生当前位置装载**；
> 学情与日志仅存本地，**不做教师端**。
>
> 拍板状态：Q1 文档分层 ✅ ｜ Q2 单包分层 ✅ ｜ Q5 交互形态 ✅（方案 D，见 ADR-0002）
> ｜ **Q3 内容格式 ⏳ 待定** ｜ **Q4 存储实现 ⏳ 待定** ｜ **Q6 教材装载方式 ⏳ 待确认**（ADR-0004）

---

## 1. 仓库边界

| 目录 | 内容 | 进 git |
|---|---|---|
| `src/` `content/units/` `tools/` `evals/` `tests/` | 代码与教学内容结构 | ✅ |
| `docs/` | 架构、规范、路线、specs、adr、tutorials、研习设计 | ✅ |
| `notes/` | 调研报告、学校信息、个人决策记录、参考项目分析 | ❌ gitignore |
| `content/textbook/` | 教材原文（全册提取结果） | ❌ gitignore（版权 + 体积） |
| `content/curriculum/` | 课程标准等教学文件原文 | ❌ gitignore（版权） |
| `.env` | API Key | ❌ gitignore |

**规则**：教材与课标**原文永不入库**；仓库只放"结构与引用"（章节索引、知识点、课标条目编号与短引用）。

## 2. 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Electron + electron-vite |
| 界面 | Vue3 + TypeScript + Pinia（组件库按需引入） |
| Agent 运行时 | TypeScript，跑在**主进程**；DeepSeek 原生 function calling，不引入 LangGraph |
| 大模型 | DeepSeek `deepseek-chat`（唯一云端依赖，流式 SSE） |
| 教材装载 | **结构化按需装载**（册 → 章 → 节）；向量检索为可选增强，见 ADR-0004 |
| 校验 | Zod（IPC 入参、内容文件、工具参数） |
| 本地存储 | ⏳ 待定：SQLite 或 JSONL（接口已定，见 §6） |
| 测试 | Vitest |
| 打包 | electron-builder（win: portable exe；mac: dmg，GitHub Actions 构建） |
| 开发期工具 | Python 3.11+（`tools/`，不进 exe）。⚠️ **现状**：`tools/` 目前只有 `md_to_docx.py`（问卷等文档转换）；教材/课标文本提取脚本属 M2 **待建** |

## 3. 目录结构

```
├─ src/
│  ├─ main/        # Electron 主进程：窗口、IPC、配置、注入实现
│  ├─ preload/     # contextBridge 暴露的类型化 API（无业务逻辑）
│  ├─ renderer/    # Vue3 界面（无 Node 权限）
│  ├─ shared/      # ⭐ 零依赖纯代码，三层都可引用（如正文区块解析、搜索高亮切分）
│  └─ core/        # ⭐ 纯领域逻辑，可单测，不依赖宿主
│     ├─ agent/    # Agent 循环、工具注册表、答案泄漏护栏（M3）
│     ├─ prompts/  # 分层提示词（按版本组织，当前 v2；旧版冻结作 A/B 基线）
│     ├─ domain/   # 领域契约（Zod）——已落地
│     ├─ storage/  # StudentStore 接口（实现待定）
│     ├─ content/  # TextbookLibrary 接口（全册教材 + 课标）
│     └─ llm/      # LLMClient 接口 + Mock 实现
├─ content/
│  ├─ units/       # 单元结构：章节索引、知识点、常见误区（进 git）
│  ├─ curriculum/  # 课标原文（不进 git）+ 课标↔知识点映射（进 git）
│  └─ textbook/    # 全册教材原文（不进 git）
├─ tools/          # Python 开发期工具（PDF → 结构化文本）
├─ evals/cases/    # 教学行为评测用例
├─ docs/           # 文档（含 研习设计.md）
└─ notes/          # 不进 git
```

## 4. 分层依赖铁律

```
renderer ──(仅经 preload 暴露的 API)──▶ main ──▶ core
renderer ──(可直接引用)──▶ shared          # 零依赖纯代码，如正文区块解析、搜索高亮
core  ✗ 不得 import electron / vue / pinia
main  ✓ 可用 node:*，但业务逻辑必须放 core
```

- renderer 需要 core 的**类型**时，只允许 `import type`
- `src/shared/` 是**唯一的跨层共享区**：里面必须是零依赖纯函数（连 `import` 都不许有），
  这样"给渲染进程用"不会把主进程的依赖带进界面包
- 违反此规则的需求一律打回；`tests/smoke.test.ts` 已自动把关三条：
  core 不得依赖宿主、`src/shared` 必须零依赖、renderer 不得直接引 core/main

## 5. 安全与 IPC

- 安全基线：`contextIsolation: true`、`nodeIntegration: false`、禁用 remote；渲染页 CSP 禁止远程脚本
- **API Key 永不进 renderer**；只在主进程按优先级读取：环境变量（dev）→ 用户配置 `userData/config.json`（打包后，M5 向导）→ 基站（可选）
- 通道命名 `<域>:<动作>`（如 `agent:chat`），入参/返回值均 Zod 校验；preload 只做转发
- 生成的教学 HTML 在受限 iframe 中展示，禁止外链与 Node 能力
- 外链一律交系统浏览器打开
- ⛔ **禁止在应用内嵌第三方网页版 AI**（如 WebView 裹 `chat.deepseek.com`）：该站点 CSP
  `frame-ancestors 'none'` 会拒绝内嵌；桌面端嵌真网页需"原生子窗口叠加"，会吃掉指针事件、
  遮挡浮层，且常驻约 380MB 内存。AI 能力一律走 API（实测见
  `notes/reference/markdown-reader-flutter-借鉴.md`「内嵌 DeepSeek 网页版」一节）

## 6. 领域契约（`src/core/domain/index.ts`）

稳定字段：教材单元 / 小节 / 知识点（含前置知识与常见误区）/ 学情（掌握度三态）/
学生会话与轮次 / **学习模式（预习·复习·做题·拓展）** / **学习位置（册·章·节）**。

| 契约 | 说明 |
|---|---|
| `StudyMode` | 学生自选的四种意图；Agent **不猜**"这周教到哪"，而是主动询问后让学生选 |
| `StudyPosition` | 决定装载哪部分教材；全册入库、按位置取用 |
| `Turn.flags` | 护栏命中（answer-leak-guard）、疑似抄作业、超纲建议问老师等标记，**用于研习统计** |

> 已移除：`TeachingPlan`（教学进度表）——不依赖教师排课；
> `aggregateKpInquiries`（全班聚合）——**不做教师端，避免学生隐私风险**。

### 可插拔的接口（吸收未定项）

```ts
interface TextbookLibrary {            // 全册教材 + 课标；格式待定（Q3）
  listVolumes(); listUnits(volumeId); getUnit(id);
  listKnowledgePoints(unitId); getKnowledgePoint(id);
  getSectionText(sectionId);           // 教材原文（不入 git）
  getCurriculumRequirements(unitId);   // 课标要求（约束层）
  buildStudyScope(position, mode);     // 运行期核心：装配要注入的上下文
}
interface StudentStore {               // 数据存哪：SQLite / JSONL 待定（Q4）
  upsertStudent(); createSession(); appendTurn(); listTurns();
  upsertMastery(); getMastery(); setMasteryState();
}
```

**上层代码只依赖这两个接口**。将来无论选哪种实现，只新增一个实现文件 + 在主进程注入，
其余代码零改动——这是让"还没想好"不阻塞开发的关键设计。

### 合规内建

- `studentId` 只接受 `S01` 形式编号（Zod 强制），姓名映射表不落库
- **不做教师端**：不提供班级聚合、不提供教师查看学生对话的界面
- 研习数据以**问卷**为主渠道获取（见 §9）

## 7. Agent 运行时设计

**一轮的完整流程**：

```
① 开场：Agent 主动询问意图 ——「今天想做什么？预习 / 复习 / 做题 / 拓展」
② 学生四选一（并确定学习位置：册·章·节）
③ buildStudyScope(position, mode) 装配上下文：
     教材原文（按节）+ 知识点 + 常见误区 + 课标要求（约束层）
④ Agent 循环：调 LLM（带 tools）→ 有 toolCalls 则执行并回填 → 直到产出最终回答
⑤ 答案泄漏护栏：判定"是否把答案说出来了" → 命中则加严指令重生成一次并打标
⑥ 结果推送到界面整段呈现（**落库待 F-013**；逐字流式待界面迭代，护栏重写与流式的冲突见 F-010 的决策）
```

- 循环上限 5 次；LLM 失败必须降级为可读中文提示，不得崩溃
- 各模式的具体交互流程（问什么、怎么推进、如何收尾）**待后续细化**

**提示词分层**（`src/core/prompts/`，按版本组织，**当前 v2**）：
L0 人格 / L1 教学纪律 / **L2 教材与课标约束** / L3 学情摘要（仅本地使用） / L4 学习模式与位置；
对话历史不进 system，作为 user/assistant 消息附在其后。

版本规矩（详见 `src/core/prompts/README.md`）：**同一时刻只有一版生效**（`prompts/index.ts` 一行切换）、
**旧版冻结**作 A/B 基线、**只保留"当前版 + 上一版"**。改教学规则或语气必须升版本；
想直观比较两版语气跑 `pnpm prompts:compare`。

**答案泄漏护栏**：命中率是核心研习指标，必须落库可统计。

**离线 / Mock 模式**：`MockLLMClient` 提供脚本化响应，用于测试、断网演示与无网机房。

## 8. 内容工程流水线（全册）

```
① 教材 PDF（全册）→ tools/extract_textbook.py（⚠️ **待建**，M2）
     → content/textbook/<volume>/<unit>/<section>.md（不进 git）
② 课标 PDF → tools/extract_curriculum.py（⚠️ **待建**，M2）
     → content/curriculum/<source>.md（不进 git）
③ 结构化：章节索引 + 知识点 + 常见误区 + 课标↔知识点映射
     → content/units/<unit>/*（进 git，格式待定，见 ADR-0003）
④ 正文里的"想一想 / 答案"按折叠标记包裹后交给界面（约定见 ADR-0003「决策三」）：
     `:::think 想一想` … `:::`  与  `:::answer` … `:::`
     解析器 `src/shared/section-blocks.ts`；渲染层不用 v-html，未闭合的块退化为普通文本
⑤ 校验：引用完整性、前置知识无环、课标映射可追溯（M2 实现）
```

**为什么全册入库而不是只做一册**：学生可能预习、复习、做题跨章节取用；
但**运行时只装载"当前位置"对应的内容**，不把全书塞进上下文。

## 9. 问卷与研习数据（本项目的数据来源）

因为当前对中小学生使用生成式 AI 监管较严，本项目采用**以问卷为接触与数据渠道**的方式：

| 环节 | 做法 |
|---|---|
| 接触方式 | 学生在**问卷/受控活动流程**中接触产品，而非自由下载使用 |
| 前测 | 问卷收集已有概念水平、AI 使用经验 |
| 体验 | 在受控环境（机房/课后服务时段，教师在场）限时体验 |
| 后测 | 问卷收集概念理解变化、使用体验与态度 |
| 对话数据 | 仅存学生本机；研习分析以问卷与课堂观察为主，必要时经同意后匿名化引用片段 |
| 教师端 | **不做**（隐私优先） |

## 10. 打包与分发

- Windows：**两种形态并存**（见 `docs/adr/ADR-0006`）——
  `portable` 便携版（免安装，规避机房权限）与 `nsis` 安装版（per-user、不需要管理员、可卸载）；
  macOS：`dmg`（GitHub Actions 构建，**尚未构建过**）
- 教学内容的**分发边界**（见 `docs/adr/ADR-0007`）：只有"我们自己编写的结构"（`content/units/`）
  才允许随包；**教材原文（`content/textbook/`）只在本机，绝不随包、绝不进公开仓库**
  （教材许可写明"仅供个人学习使用，未经授权不得另做他用"）。
  现状（2026-09-27 用户拍板）：**`content/units/` 已通过 `extraResources` 随包**
  （知识点 / 课标要求 / 印刷页出处）；教材正文不随包，因此**学生机是"有结构、没有正文"**：
  运行时会装到真实结构（不再回落演示内容），界面显示"本机没有教材正文，请对照课本第 X 页"，
  提示词里也明确**禁止引用或编造课本原句**，改为让学生念出课本段落再引导
  （演示占位文本只在"开发机完全没有 content/units"时出现，且界面会显式标注"演示内容"）
- 该边界由 `tests/packaging-guard.test.ts` 自动把关（打包配置不得整体映射 `content/`）
- 未签名应用会被 SmartScreen 拦截 → 分发时附"仍要运行"说明
- 仅向本班小范围提供，不公开传播（合规锚点）

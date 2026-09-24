# 芽问 SproutAsk

> 面向北京市三帆中学初中生物教育实习的**教育研习项目**。
> 一个本地优先的桌面 Agent：知道你们班这周教到哪，不给答案，而是通过提问、出题、互动实验带着学生一步步学会。
>
> DeepSeek API 只作推理外脑；教材原文注入上下文；学情与对话日志存本地。

## 先读这几份

| 文档 | 内容 |
|---|---|
| `docs/ARCHITECTURE.md` | 架构、目录边界、分层铁律、领域契约、可插拔接口 |
| `docs/CONVENTIONS.md` | 编码规范、命名、测试、Git 流程、合规红线、**独立对话开工模板** |
| `docs/ROADMAP.md` | 里程碑、需求清单（F-0XX）、**待决策清单** |
| `docs/研习设计.md` | **研习课题**：题目、研究问题、理论框架、方法、伦理、报告结构 |

写新需求前先看 `docs/specs/`（每条需求一份 spec）；架构决策记录在 `docs/adr/`。

## 快速开始

```powershell
pnpm install
pnpm dev          # 启动 Electron 应用（会打开一个窗口）

pnpm chat         # 🆕 终端里和小芽对话（需先在 .env 配好 DeepSeek Key）
pnpm eval         # 🆕 教学行为评测跑批（真实调用模型，注意费用）

pnpm typecheck    # 类型检查（node + web 两端）
pnpm test         # 单元测试（含"core 层不得依赖 electron/vue"的自动把关）
```

`.env`：复制 `.env.example` 为 `.env`，填入 DeepSeek API Key（主进程会自动读取项目根目录的 `.env`）。

`$env:SPROUTASK_SELFTEST = "1"; pnpm dev` —— 界面自检：在真实应用里操作 DOM 并断言（渲染/交互/样式/降级），
无需人工点击；通过时退出码 0，并输出截图 `selftest-ui.png`。

### 环境相关的两个坑（已解决，重装时可参考）

1. **pnpm 默认拦截依赖的构建脚本**：放行名单写在 `pnpm-workspace.yaml` 的 `allowBuilds`
   （注意 pnpm 11 已不再读取 `package.json` 里的 `pnpm` 字段）。缺了会出现
   `ERR_PNPM_IGNORED_BUILDS`，Electron 二进制不会被下载。

2. **Electron 二进制下载失败**（国内网络常见）：`.npmrc` 里配的镜像键 pnpm 不识别，
   手动用环境变量补下载：

   ```powershell
   $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
   cd node_modules/electron; node install.js
   ```

   验证：`node_modules/electron/dist/electron.exe` 存在（约 180 MB）。

## 目录结构

```
├─ src/
│  ├─ main/       # Electron 主进程：窗口、IPC、配置注入（可用 node:*）
│  ├─ preload/    # contextBridge 桥接（只转发，无业务逻辑）
│  ├─ renderer/   # Vue3 界面（无 Node 权限）
│  └─ core/       # ⭐ 纯领域逻辑：契约、Agent、提示词、LLM、存储与内容接口
├─ content/       # units/（结构，进 git）；textbook/ 与 curriculum/（原文，不进）
├─ tools/         # Python 开发期工具（不进 exe）
├─ evals/cases/   # 教学行为评测用例
├─ tests/         # 单元测试
├─ docs/          # 架构 / 规范 / 路线 / 研习设计 / specs / adr / tutorials
└─ notes/         # 调研与个人记录（不进 git）
```

## 当前进度与待决策

- ✅ M0 骨架（可运行、可测试、规范就位）
- ✅ M1 提示词与 LLM 客户端（`pnpm chat` 终端对话、`pnpm eval` 评测；离线部分已实测，
  **真实 API 联调待你配好 `.env` 后跑一次**）
- ✅ 关键决策：交互形态 = 方案 D（对话 + 可折叠教材阅读视图）；不做教师端；
  教材全册结构化入库、按位置装载（ADR-0002/0004）
- ⏳ 下一步 M2 内容工程（等教材版本确认）与 M3 Agent 循环
- 待决策：Q3 内容格式、Q4 存储实现、Q8 各模式内部交互流程 —— 见 `docs/adr/` 与 `docs/ROADMAP.md`

## 学习资料

零基础开发教程在 `docs/tutorials/`（环境准备 → 提示词沙盒 → 教材处理 → …）。

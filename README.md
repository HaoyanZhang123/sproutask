# BioBuddy

> 面向北京市三帆中学初中生物教育实习的**教育研习项目**。
> 一个本地优先的桌面 Agent：知道你们班这周教到哪，不给答案，而是通过提问、出题、互动实验带着学生一步步学会。
>
> DeepSeek API 只作推理外脑；教材原文注入上下文；学情与对话日志存本地。

## 先读这三份

| 文档 | 内容 |
|---|---|
| `docs/ARCHITECTURE.md` | 架构、目录边界、分层铁律、领域契约、可插拔接口 |
| `docs/CONVENTIONS.md` | 编码规范、命名、测试、Git 流程、**独立对话开工模板** |
| `docs/ROADMAP.md` | 里程碑、需求清单（F-0XX）、**待决策清单** |

写新需求前先看 `docs/specs/`（每条需求一份 spec）；架构决策记录在 `docs/adr/`。

## 快速开始

```powershell
pnpm install
pnpm dev          # 启动 Electron 应用（会打开一个窗口）

pnpm typecheck    # 类型检查（node + web 两端）
pnpm test         # 单元测试（含"core 层不得依赖 electron/vue"的自动把关）
```

`.env`：复制 `.env.example` 为 `.env`，填入 DeepSeek API Key（M1 起才会真正用到）。

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
├─ content/       # 教学内容（units/ 进 git；textbook/ 不进）
├─ tools/         # Python 开发期工具（不进 exe）
├─ evals/cases/   # 教学行为评测用例
├─ tests/         # 单元测试
├─ docs/          # 架构 / 规范 / 路线 / specs / adr / tutorials
└─ notes/         # 调研与个人记录（不进 git）
```

## 当前进度

- ✅ M0 骨架（可运行、可测试、规范就位）
- ⏳ M1 提示词与 LLM 客户端（下一步）
- 待决策：Q3 内容格式、Q4 存储实现、Q5 是否采用"关卡"形态 —— 见 `docs/adr/`

## 学习资料

零基础开发教程在 `docs/tutorials/`（环境准备 → 提示词沙盒 → 教材处理 → …）。

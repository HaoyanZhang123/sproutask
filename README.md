# 芽问 SproutAsk

> 装在学生电脑上的**初中生物学习伙伴**：不给答案，用提问带学生自己把知识想明白；
> 所有解释锚定教材原文与课程标准。同时是一份教育研习课题（见 `docs/研习设计.md`）。
> 面向北京市三帆中学初中生物教育实习。

**📌 想知道"做到哪了、上次干了啥、下一步做什么"——只看 `docs/PROGRESS.md`（唯一进度来源）。**
**🧑‍🎓 想从零学会怎么打开使用——看 `docs/tutorials/README.md`（零基础使用指南）。**

## 快速开始

```powershell
cd D:\dsh\ai4edu
pnpm install
cp .env.example .env      # 打开 .env，把 DEEPSEEK_API_KEY 填成你自己的 Key
pnpm dev                  # 打开桌面窗口
```

**怎么判断程序是正常的**：

```powershell
$env:SPROUTASK_SELFTEST = "1"; pnpm dev
```

看到 `[selftest] 结果：通过`（43 项断言（无 Key）/ 35 项（有 Key），含界面渲染、点击、样式、降级）就算正常，
同时会生成一张截图 `selftest-ui.png` 供你肉眼看。

## 常用命令

| 命令 | 作用 | 需要 Key 吗 |
|---|---|---|
| `pnpm dev` | 打开桌面应用（推荐日常使用） | 对话需要 |
| `pnpm chat` | 在终端里和小芽对话（更轻量，适合调试） | 需要 |
| `pnpm test` | 单元测试（154 例，**不需要联网**） | 不需要 |
| `pnpm typecheck` | 类型检查（主进程 + 界面两端） | 不需要 |
| `$env:SPROUTASK_SELFTEST="1"; pnpm dev` | 界面自检（无头 DOM 断言 + 截图） | 不需要 |
| `pnpm eval` | 教学行为评测跑批（**会真实调用模型，产生费用**） | 需要 |
| `pnpm build` | 只做构建（产出 `out/`），不打包安装包 | 不需要 |
| `pnpm build:win` / `build:mac` | 打包：Windows 产出**便携版 + 安装版**两个 exe；macOS dmg **从未实测** | 不需要 |

## 目录结构

```
├─ src/
│  ├─ main/       # Electron 主进程：窗口、IPC、配置注入（可用 node:*）
│  ├─ preload/    # contextBridge 桥接（只转发，无业务逻辑）
│  ├─ renderer/   # Vue3 界面（无 Node 权限）
│  ├─ shared/     # ⭐ 零依赖纯代码，三层可共享（正文区块解析、搜索高亮）
│  └─ core/       # ⭐ 纯领域逻辑：契约、Agent、提示词、LLM、存储与内容接口
├─ content/       # units/（结构，进 git）；textbook/ 与 curriculum/（原文，不进 git）
├─ tools/         # Python 开发期工具（不进 exe）
├─ evals/cases/   # 教学行为评测用例（YAML，可读可改）
├─ tests/         # 单元测试
├─ scripts/       # 终端对话、评测跑批
├─ docs/          # PROGRESS（进度）、ARCHITECTURE、CONVENTIONS、ROADMAP、specs、adr、tutorials
├─ notes/         # 调研与个人记录（不进 git）
└─ publish/       # 开源发布工具（不上传）
```

## 环境相关的两个坑（已解决，重装时可参考）

1. **pnpm 默认拦截依赖的构建脚本**：放行名单写在 `pnpm-workspace.yaml` 的 `allowBuilds`。
   缺了会报 `ERR_PNPM_IGNORED_BUILDS`，Electron 二进制不会被下载。

2. **Electron 二进制下载失败**（国内网络常见）：`.npmrc` 里配的镜像键 pnpm 不识别，
   手动用环境变量补下载：

   ```powershell
   $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
   cd node_modules/electron; node install.js
   ```

   验证：`node_modules\electron\dist\electron.exe` 存在（约 180 MB）。

> 更多坑（共 13 条）见 `docs/PROGRESS.md` 第 6 节与 `CODEBASE_NOTES.md`。

## 文档分工

| 你想知道 | 看哪份 |
|---|---|
| **进度 / 上次做了什么 / 下一步** | `docs/PROGRESS.md` |
| **怎么装、怎么打开、怎么用** | `docs/tutorials/README.md` |
| 架构、目录边界、分层铁律 | `docs/ARCHITECTURE.md` |
| 编码规范、测试、Git 流程、合规红线 | `docs/CONVENTIONS.md` |
| 里程碑与需求编号（F-0XX） | `docs/ROADMAP.md` |
| 某条需求做了什么、怎么验收 | `docs/specs/` |
| 为什么这样设计 | `docs/adr/` |
| 研习课题本身（题目/方法/报告） | `docs/研习设计.md` |

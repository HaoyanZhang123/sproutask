# 架构（ARCHITECTURE）

> **适用范围（2026-11-04 起）**：仓库只有一条产品线 `education/`。旧 Electron + Vue 线已归档到
> [`docs/history/`](history/README.md)（架构旧版：`history/ARCHITECTURE-legacy.md`）。本文件只描述现行系统。

---

## 1. 范围

芽问是给**一名学生、一台 Windows 电脑**用的学习工作区：读教材、作答、获得带出处的解释与纠错，并在本机留下学习记录。

- **不做**教师端（班级聚合 / 教师查看对话）、网页版、多租户、学生姓名档案。
- 云端只承担推理（DeepSeek API）；教材、学情、对话只在本机。
- 交互形态：本机后台服务 + 一个 Edge `--app` 窗口（不是 Electron）。

## 2. 形态与运行

```
launcher.vbs → launcher.cmd → node app/runtime/scripts/start-student-web.mjs
   → 固定版本 DSH web（仅 127.0.0.1 回环，随机端口）
   → 教育 host 插件（/edu/api/*）
   → 教育 client 插件接管根渲染（学生界面）
   → Edge --app 打开窗口；Edge 退出时结束 DSH 子进程
```

- 首次运行生成隔离的 `DSH_HOME/profiles/edu-web`，本地插件用 junction 链接，不碰用户已有 DSH 配置。
- 模型 Key 由宿主侧保存（DPAPI），进程启动时加载；**渲染层永远拿不到 Key**。
- 无 Key 时 `status=degraded`：教材、地图、记录可读，模型调用明确不可用。

## 3. 仓库结构

```
ai4edu/
├─ education/                  ← 唯一产品
│  ├─ packages/                纯领域代码（无 DSH / React / Electron 运行时依赖）
│  │  ├─ domain/               领域类型与校验（Zod）
│  │  ├─ storage/              事件日志（JSONL）、快照、恢复、导出删除
│  │  ├─ knowledge/            目录树、概念关系、内容查询
│  │  ├─ learner/              三轴状态、复习安排、自评
│  │  ├─ tutor/                教学会话、活动、评分与披露策略
│  │  ├─ visuals/              图示、反馈、图片作答
│  │  └─ importer/             PDF / 教材导入
│  ├─ client/                  无框架 DOM 学生界面（零运行时依赖）
│  │  ├─ shell/                外壳、导航、今天、记录、设置、首次使用
│  │  ├─ study/                学习台（材料 / 题目 / 反馈 / 助手）
│  │  ├─ map/                  两级知识地图（全册 + 章级关系）
│  │  ├─ library/              我的课本 / 来源
│  │  └─ visuals/              图示与反馈组件
│  ├─ runtime/                 DSH 边界层
│  │  ├─ src/                  组合根、G1 服务、页面注册、适配器
│  │  ├─ host-plugin/          Host 插件（/edu/api/*、工具）
│  │  ├─ client-plugin/        Client 根占用方（装载学生界面）
│  │  └─ scripts/              隔离 home 的生成 / 启停
│  ├─ content/biology-7a/      内容包（概念、活动、评分、关系、出处）
│  ├─ desktop/                 学生包启动器（cmd / vbs / node）
│  ├─ skills/biology/          教学 Skill
│  ├─ scripts/                 构建、校验、打包、任务检查
│  ├─ licenses/                第三方许可清单
│  ├─ tests/                   跨包契约与集成测试
│  └─ .local/                  本机证据、缓存、密钥（gitignore）
├─ content/                    本机教材原文归档（gitignore，不随包）
├─ docs/                       进度、架构、规范、交接包、发布、历史
└─ dev-dashboard/              产品进度看板（四份 Markdown）
```

## 4. 分层与依赖

```
client/*  ──依赖──▶ packages/*（类型与纯函数）
runtime/* ──依赖──▶ packages/* + DSH（仅出现在适配器/组合层）
packages/* ──禁止──▶ DSH / React / Electron / client / runtime
```

- `packages/` 是纯领域层：不 import DSH、React、Electron；可以被离线测试直接跑。
- `runtime/adapters/` 是**唯一**接触 DSH 的地方；换 DSH 版本只改适配器与组合根。
- `client/` 是浏览器侧手写 DOM，不引框架；共享的是 `@edu/*` 的类型与少量纯函数。
- `scripts/` 是开发期工具，不进学生包。

## 5. 公共契约与数据

- **契约来源**：`docs/rebuild/05-data-contracts.md` + `education/packages/domain` 的 Zod schema；`docs/rebuild/contract-lock.json` 锁定字段，`pnpm contract:lock:verify` 把关。
- **事件日志**：追加式 JSONL（`eventId` / `seq` / `occurredAt` / 载荷），快照 + 崩溃恢复；UI 与模型不直接写日志。
- **三轴分开**：学习进程、理解证据、复习活动各自存储与显示；自评独立保存，不进证据判断。**不出现 0–100 掌握百分比**。
- **出处**：概念/活动绑定教材页（印刷页 + PDF 页）；解释必须能追到来源。
- **本地数据根**：安装版 `%LOCALAPPDATA%\SproutAsk\data`（dsh-home / learner-data / logs / edge-profile）；开发态在 `education/.local/cache/T01/dev-home`。

## 6. 安全与隐私

- 服务只绑定 loopback；启动脚本会清掉环境里的 `DEEPSEEK_*` / `DSH_*` 等变量，只从本机密钥文件读 Key。
- 渲染层：`contextIsolation`、无 Node、CSP 禁止远程脚本；Key 只显示"已配置 / 未配置"。
- 学生只用编号（`learner.local.*`），不收集姓名/电话；不做教师端。
- 教材原文、课标原文、密钥、`.local/` 证据一律不进 git、不进包。

## 7. 内容流水线

```
教材 PDF → importer（本机）→ 内容包 education/content/biology-7a/
  → pnpm content:validate（引用完整性、页码、关系）
  → pnpm contract:lock:verify（公共字段未漂移）
  → 打包时只带内容包，不带原文
```

内容包按 `pack.json`（版本）、`concepts`、`activities`、`rubrics`、`relations`、`source/*`（block-index、页映射）组织；
新增/修改内容必须同时更新校验与出处，不允许手改出不一致。

## 8. 打包与分发

- `education/scripts/packaging/build-student-payload.mjs` → `education/dist/student/`（node、app、content、skills、licenses、launcher）。
- `build-installer.mjs` → 安装版（per-user，免管理员，写 `%LOCALAPPDATA%\SproutAsk\current`，卸载保留 `data/`）。
- 便携版为 zip；两者都未签名，附 `SHA256SUMS`。
- 裁剪：LibreOffice、语音、PTY、`sharp` 默认不带（图片走教育自有管线）。

## 9. 质量门与验收

- 全量：`pnpm typecheck && pnpm test`（14 个项目，663 用例，2026-11-04 基线）。
- 契约/内容：`pnpm test:contracts`、`pnpm content:validate`、`pnpm contract:lock:verify`。
- 界面：三档分辨率截图走查 + 学生文案禁词扫描。
- 验收口径：`docs/rebuild/07-acceptance.md` 的 A01–A36 与 G1/G2/G3 门；报告在 `docs/rebuild/reports/`。

## 10. 决策与历史

- 现行决策写在 `docs/rebuild/`（产品契约、公共契约、系统设计、验收），不另建 ADR 目录。
- 旧线 ADR-0001–0007 在 `docs/history/adr/`；其中**"教材原文只在本机"**这条原则继续有效，已并入 `AGENTS.md` 红线。
- 收拢前的完整旧线状态可用 tag `pre-cleanup-2026-11-04` 找回，方法见 `docs/history/README.md`。

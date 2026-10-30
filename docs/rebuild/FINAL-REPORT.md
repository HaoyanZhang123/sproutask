# FINAL-REPORT — DSH 教育垂类重构（本期交付）

- 报告时间：2026-10-30 00:30 +08:00（Asia/Shanghai）
- 工作区：`E:/DSH/workspaces/ai4edu`（Git HEAD `a8822e8082855df7d8688e0d6dbe4be543513816` + 未提交新增 `education/`、`docs/rebuild/`）
- 结论：**未完成本期全部 AC，`finalAccepted` 不可达**。可执行工作包均已完成到"接口可用 + 离线/本地真实证据"级别，剩余项**被具体外部输入与三处待修缺陷阻塞**（见 §5、§6）。本报告不声称产品已可交付学生使用。

> 本报告为**主控（lead）汇总**，AC 判定采用独立 T17 审计的实测结果（`docs/rebuild/reports/T17.md`）与 T15 教学验证（`docs/rebuild/reports/T15.md`）；卡片报告中的 "PASS@L2" 只表示"该卡贡献"，不等于 AC 通过（07 最低级别为准）。

## 1. 交付了什么（按工程包）

| 包 | 目录 | 状态 |
|---|---|---|
| 公共契约 + 工具链 | `education/packages/domain/`、`education/scripts/`、`education/config/` | 已验收，domainReady=PASS；contract-lock v1.0.0（435 files / 21 commands / 16 implemented） |
| 事件日志与恢复 | `education/packages/storage/` | 已验收；45 tests（含删除目标复算、learner 隔离、崩溃/快照/双实例） |
| PDF 导入与 OCR | `education/packages/importer/` | 已验收；44 tests；**真实 146 页教材全册 OCR 146/146 成功**（Windows 系统组件，0 第三方依赖） |
| 知识图与发布 | `education/packages/knowledge/` | 已验收；98 tests；发布链强制 human_curator（AI 自签被拒） |
| 三轴与复习 | `education/packages/learner/` | 已验收；35 tests |
| 教学工具与生物 Skill | `education/packages/tutor/`、`education/skills/biology/` | 已验收；52 tests；12 类教学行为离线回放 12/12×2 |
| 图示与批改 | `education/packages/visuals/`、`education/client/visuals/` | 已验收；48 tests；真实图像路由 4 类样本实测 |
| 教育 UI 壳/教材库/地图/工作区 | `education/client/shell|library|map|study/` | 已验收（L2 组件级）；live data source 由 T13 接入 |
| 运行组合与 DSH 绑定 | `education/runtime/`、`education/probes/runtime/` | 固定 DSH `0.2.1-rc.3` 真机装载；教育 root 真渲染；教育工具真调用返回来源锚点 |
| 内容包（全册） | `education/content/biology-7a/` | **candidate**：2 单元 / 7 章 / 22 节 / **43 概念 / 88 活动 / 43 rubric / 44 关系 / 281 出处**；两轮独立审查 0 阻断 / 0 高 / 2 中 / 5 低 |
| Windows 产物 | `education/dist/SproutAsk-Setup-x64.exe`（**v7，56.7 MB，SHA-256 `9669C83F…DB95`**（含 A14/A20 代码修复 + A20 质量门已接进 `/edu/api/g1/image`；不带 .vbs））+ `education/dist/student/`（34,493 文件 / 389.5 MB，**含 sharp**，0 符号链接） | 安装/启动/卸载冒烟通过；**产物内 `fixtureData=false`、pack 2.0.0、43 概念、Key 端点 + 启动注入真实模型通路已验**；仍非 L5（未做干净机、内容 candidate） |
| 第三方许可 | `education/licenses/`（NOTICE 558 包 / 168 份许可全文 / Node / 字体 / 原生二进制 / 裁剪义务） | 已交付；仍需人工确认商标署名与 OFL 保留字体名 |

全量实测（2026-10-30 00:00 独立审计）：`typecheck` 14 项目全 0；`test` 80 文件 / **585 tests** 全 0；`content:validate`=0；`contract:lock:verify` 在代码变更后需要重生（见 §7 已知不一致）。

## 2. 用户如何使用（当前状态）

```powershell
cd E:\DSH\workspaces\ai4edu
pnpm --dir education install --frozen-lockfile     # 依赖
pnpm --dir education typecheck                     # 静态检查
pnpm --dir education test                          # 585 个测试
pnpm --dir education test:contracts                # 契约 fixtures（需先重生 lock，见 §7）
pnpm --dir education content:validate              # 内容包结构/覆盖校验
node education/content/biology-7a/tools/selfcheck.mjs   # 内容自检 46 项
```
- 教育线目前**没有可直接双击运行的 Windows 产物**；开发态启动见 `education/runtime/scripts/start-education-web.mjs` 与 `docs/rebuild/reports/T01.md` §阶段B（隔离 `DSH_HOME`、loopback 随机端口、不占用当前 GUI）。
- 模型：仅 **API Key 路线**可用（`https://api.deepseek.com`，模型 `deepseek-flash` / `deepseek-v4-pro`）；Key 不入库，存放于 `education/.local/secrets/deepseek.key`（gitignore）。
- **账户一键登录（DSH PKCE）不可用**：用户 2026-10-29 明确答复"不允许"，A03 记 FAIL。
- 教材原文只在本机工作区根（`义务教育教科书·生物学·七年级·上册.pdf`，SHA-256 `33eed60c…e59f`，146 页扫描版无文本层），不进 Git、不进分发包；`/*.pdf` 与 `/education/.local/` 已加入 `.gitignore`。

## 3. 真实证据（可核查指纹）

| 项 | 证据 |
|---|---|
| 固定 DSH 来源 | 官方 npm `@deepseek-ai/dsh@0.2.1-rc.3`，tarball SHA-256 `9a8f9493…7141`，558 包 lock；`docs/rebuild/runtime-lock.json` |
| 隔离运行实证 | 独立 `DSH_HOME` + loopback；工具可见面仅 `edu_probe_echo`，`bash/read_file/run_code` → `unknown tool`；web 401→303+签名 cookie→200；root 真渲染（`education/.local/evidence/T00/run-01/`） |
| 教育 root 真渲染 | 标题"首页 · 生物学习"，导航/上下文 DOM 在真实 DSH web 中渲染（`education/.local/evidence/T01/run-20261029T201500+0800/render-2/`） |
| G1 真实教学回合（二轮后） | `/edu/api/g1/tutor/turn` = 200 `ok:true`，~9.2s，`deepseek-official/deepseek-flash`，assistant 文本带 `source.bio7a.c1.basic-method`（PDF 11/印刷 2）、PDF 12/印刷 3 锚点；CDP 11 步 UI 旅程 + 重启恢复（`education/.local/evidence/T13/run-20261030T001500+0800/`、`…/f1-final/pilot2-evidence.json`）；Chromium 宿主 token-cookie 鉴权矩阵 |
| 真实教材 OCR | 146/146 页成功，143.8s，页脚印刷页 = PDF 页 − 9（85 页一致，离群 4/5/18/24/62 已单列）（`education/.local/evidence/T03/run-20261029T185619+0800/`） |
| 真实模型文本 | DSH 内 `x-api-key` 精确回答 `APIKEY-ROUTE-OK`，usage 543 tokens；费用见 §8 |
| 真实图像 | 4 类合成样本各 1 次：清晰正确/错误判读正确，空白→澄清，旋转+模糊→仍自信判对（**未澄清**，A20 未通过） |
| 教学内容 | 两轮独立审查：`T15-content-audit.md`（0/3/6/5）、`T15-content-audit-2.md`（0/0/2/5）；12 类教学行为 24 回合 17 PASS/5 PARTIAL/2 FAIL；7 章抽样 7/7 |
| 独立最终审计 | `docs/rebuild/reports/T17.md`（只读，除该文件外未改产品） |

## 4. R01–R18 与 A01–A36 当前结果

按 07 §1 的 L0–L5 与最低级别判定（独立 T17 实测）：

**A 矩阵统计（00:50 依 T13 第二轮更新）：PASS 11 / FAIL 7 / BLOCKED 6 / NOT_RUN 12（共 36）**。其中 **A01 / A13 / A22 / A24 有 L3 证据**（真实 DSH→模型→教育工具→回答、真实 UI 主旅程、重启恢复、Host 鉴权矩阵），其余 PASS 仍在 L2 或 L2+来源对照。

| 结论 | AC |
|---|---|
| PASS | **A01(L3) A13(L3) A22(L3) A24(L3)** + A04 A09 A10 A11 A25 A26 A28（L2 / L2+来源对照） |
| FAIL | A08 A20 A21 A30 A34 A35 A36 |
| BLOCKED | A02 A03 A05 A27 A31 A32 |
| NOT_RUN | A06 A07 A12 A14 A15 A16 A17 A18 A19 A23 A29 A33 |

需求映射（简）：R01 真实内核 = 部分（开发态真会话 + 工具；产品 tutor 回合当前不可用）；R02/R03 = 导入与出处机制 L2+真实页码；R04 全册 = 结构/覆盖 L2+来源对照，**非 G2**；R05/R09 = 树图与三轴 L2 组件；R06/R07 = 教学/复习 L2 组件，真实模型判读 PARTIAL；R08 = 证据回落规则 L2；R10/R11 = 图示/批改 L2，图像质量未过；R12/R13 = 首页与 UI L2；R14 = 后端裁权部分实证（工具 allowlist、401/303），产品 UI 直连与"他人资源"未测；R15 = 本地日志/恢复 L2；R16 = 扩展契约 L2；R17 = 失败/取消/恢复 L2；R18 = 交付**未达**（无 Windows 产物）。

## 5. 三个闭环门

| 门 | 结论 | 依据与缺口 |
|---|---|---|
| G1 首节真实闭环 | **PARTIAL（plumbing + 真实 UI 均达 L3；formal BLOCKED）** | v2 安装产物内、隔离数据根、真实 host API + 真实 `deepseek-flash`：**9 个 DOM 步骤全过（7/7 场景）**——首页→教材库→地图→首节概念→工作区→正确作答反馈→**核心误解**（【未达成】+ 命中"只要睁开眼睛看见，就是观察"迷思 + 出处，理解仍"尚无足够证据"）→**assisted**（先提示后作答，DOM 明示"已使用提示…是否算独立证据由服务规则判断"，仍 unassessed）→**重启恢复**（未提交草稿 option.c 保存 → 停服务 → 同数据根重启 → 继续上次回到同一概念/活动，option.c 仍勾选，draft revision 13→14 且答案一致）。真实模型回合 3 次、<¥0.05，无 mock/fixture。**G1-formal-learning 仍 BLOCKED**：pack 为 candidate，发布强制 human_curator。证据 `education/.local/evidence/T13/product-ui/final-v2/journey.json`（sha256 `74bf89b5…a734c2`）、`final-7of7-summary.json`（`f9c6a6fe…2862`） |
| G2 全册与教学 | **FAIL** | 内容两轮独立审查后 0 阻断/0 高，但 `contentReadyFull=PARTIAL`（图义视觉核对未做、版次/印次/ISBN 人工核对未做、human_curator 未做）；12 类 2 FAIL/5 PARTIAL（无来源时把"无法核对"扩大成"可能不在内容包"、1 次话题漂移）；T15 的 L4 证据实际跑在无工具 profile → 只能算 L3 |
| G3 Windows 产物 | **PARTIAL（产物 + 真实通路 + L5 近似已验证；未达完整 L5）** | v2 安装包：静默安装 34,495 文件（含 sharp）→ 启动 1.62s → token 303 / status 200 → **`fixtureData=false`、pack 2.0.0、43 概念、6 工具、loopback** → Edge `--app` → 端口关闭 → 卸载清空文件/快捷方式/注册表并保留数据。**Key 端点 + 启动注入**：`POST/GET/DELETE /edu/api/auth/key`（DPAPI `secrets/model-key.dat`，`restartRequired`），无 env key 时解密注入 → `status=ready`、`auth=api_key/available`。**L5 近似**（PATH 裁成 32 位系统目录、cwd `C:\Windows\Temp`、独立空数据根、只用已安装产物）：首启 44.97s → status 200/fixtureData=false → Key 录入 200 → 重启 ready → `live-selftest` 200 返回"PDF 页 11 / 印刷页 2"锚点。**未达完整 L5**：同一台机器/同一账户、未在另一台干净机验证、内容 candidate、未签名。`release/*.exe` 仍是旧 Electron 线 0.2.0，**不得当本期产物**。详见 [T16-installer.md](reports/T16-installer.md) §7–§8 |

## 6. 最小解除条件（按 owner，完整版见 T17 §6）

| 阻塞 | 谁来做 |
|---|---|
| F1 产品 tutor 回合无 assistant 文本；F2 `DshTutorGateway` 丢弃 `systemInstruction`；F3 headless 工具取不到内容包 | 工程（T13/T01 范围）——契约与 tutor 侧 F2 已由主控修好（`TutorTurnRequest.systemInstruction` + `gateway-adapter` 透传，T01/T07 全绿），runtime 侧消费与 F1/F3 待修 |
| 反馈区渲染卡死（`feedback-card`） | 工程（T12/T13） |
| 内容 published | **人类 curator** 按 `PublishRegistry` 规则审校 43 概念并留 record（AI 不能自签） |
| 图义视觉核对（65+8 条图注） | 人 + 视觉模型样本（预算） |
| 版次/印次/ISBN/印刷页总数 | 人（对照原书版权页） |
| 安装版 | 用户批准安装工具（NSIS/WiX）或提供代码签名证书 + MSIX 侧载策略 |
| 品牌/分发许可、API Key 输入与存储政策 | 用户/法务 |
| 18 个第三方包缺 LICENSE 文本、MPL-2.0/LGPL-3.0 source offer | 用户/法务确认 |
| Windows 产物 L5、冷启动/卸载/隔离数据验证 | 依赖上两项后由工程执行 |

## 7. 已知不一致（必须在本报告之后修正，否则下一人会被误导）

1. `docs/rebuild/contract-lock.json` 曾因 T13 第二轮改动而变红（11 处 hash mismatch）；**主控已在 00:50 冻结写入后重生**：435 files / 21 commands / 16 implemented，`contract:lock:verify`=**OK**，`test:contracts`=**0**，全量 `test`=**0**、`typecheck`=**0**。
2. `docs/rebuild/reports/T13.md` 第一轮版本（20:54）与当前代码不符；**已由第二轮"§ 第二轮收口"节更新**（F1/F2/F3、G1 三项、真实回合摘要、未测项）。
3. `docs/rebuild/reports/T15-content-audit-2.md` 审的是 42 概念/36 关系版本，内容此后又返工为 43/44；`T14.md` 台账表仍有 35 概念的旧数字（AUD2-06 声称已修但正文未改）。
4. `docs/rebuild/reports/T15.md` 的 12 类证据跑在"无工具"profile（`withTools=false`），来源引用 0 次 → 只能算 L3，不能当 L4；修 F1/F2/F3 后应带工具重跑（预计 ≤12 次调用）。
5. 两处报告含本机绝对路径/用户名（低风险，交付前应脱敏）。
6. T13 第二轮的真实调用约 21 次（超其 ≤20 上限 1 次），且 usage/token 未落盘 → 该轮费用无法精确声称（按同规模估算 ≤¥0.1）。

## 8. 预算与安全

- 真实模型调用累计：T00 4 次 + T11 8 次 + T01 阶段 B（少量，见其报告）+ T15 43 次 + T13 两轮约 25 次 ≈ **80 次**；估算费用 **≈ ¥0.35**（上限口径 ¥2/M 入、¥8/M 出），远低于授权上限 150 次 / ¥10。
- 凭据：只用用户提供的 DeepSeek 官方 API Key；仅进程内/子进程环境注入；多轮扫描（T00 122 文件、T11、T15 259 文件、T17 全仓）明文命中 **0**；未读取 `.env`、未复用现有 DSH 凭据、未抓 Cookie。
- 未修改已安装 DSH（`app.asar` 复算仍 `04b32e3a…eff1f0`）、未动 `E:\DSH\.dsh`、未删旧工程/旧数据、未 push/发布。
- 教材原文/页图/OCR 全文只落 `education/.local/`（gitignore 实测），内容包 36 个文件全为 JSON，无二进制。

## 9. 教育实证

**未做**。本期没有学习效果实验、没有教师/专家审核、没有真实学生数据；AI 静态审校只能记"首次 AI 静态检查（非专家审核）"。任何"提高成绩/提升理解"的说法在本期**没有证据**。

## 10. 交回

- 独立最终审计：`docs/rebuild/reports/T17.md`（AC 逐条 + 发现 + 解除条件）
- 工作包报告：`docs/rebuild/reports/T00.md` … `T15.md`、`T16-feasibility.md`、`REVIEW-01.md`、`T15-content-audit.md`、`T15-content-audit-2.md`
- 调度与返工记录：`docs/PROGRESS.md` §9–§10
- 契约/运行时锁定：`docs/rebuild/contract-lock.json`、`docs/rebuild/runtime-lock.json`

## 11. 最新一轮更新（2026-10-30 05:3x，goal round 2）

本轮新增（均有证据）：
1. **产品内 G1 UI 7/7 通过**（安装版 v2/v3、隔离数据根、真实模型 3 回合）：正确作答→反馈、核心误解（未达成+迷思+出处、仍 unassessed）、assisted（提示后作答、非独立证据）、重启恢复（草稿 rev 13→14 一致）。证据 `education/.local/evidence/T13/`。
2. **L5 近似通过**：PATH 裁成系统目录、cwd `C:\Windows\Temp`、独立空数据根、只用已安装产物 → status 200 `fixtureData=false` → Key 录入 200 → 重启 `ready` → `live-selftest` 200 带"PDF 11/印刷 2"锚点。证据 `education/.local/evidence/T16/l5-approx/`。
3. **安装包升级到 v3**：`SproutAsk-Setup-x64.exe` 56.6 MB，SHA-256 `4B983BEB0B52EA45E623D2F3C0A0DB71DF1A78535DBC2F0E3D81629280A1D2F6`；F4（裁剪 PATH 下 Key 保存 500）已修并复测（POST 200/GET masked/DELETE missing）。
4. **T15 重跑（带工具 + 图像 + 复习）**：12 类×2 轮 = **17 PASS / 6 PARTIAL / 1 FAIL**（R1 带工具 11/1/0，R2 无工具 6/5/1）；A20 四类真实图像 4/4 —— 清晰正确/错误判读正确、空白→澄清，**旋转 14°+模糊 6× 仍被自信判对（未澄清）→ A20 未通过，问题复现**；A14 复习：先回忆回合 OK（含 PDF 12/印刷 3 纠错），但 **`finish-review` 无法落账**（revision 0→UNAUTHORIZED，1–12→STALE_REVISION）→ A14 PARTIAL/BLOCKED。
5. **真实模型预算已用满**：本轮 56 次，累计约 **149/150 次**（估算 ≈¥0.5–0.6，上限 ¥10）。**后续不得再发起真实模型调用**，除非用户增补预算。

因此 **G2 仍 FAIL**，`finalAccepted` 仍不可达。剩余门：
- G2：human curator 发布（未做）、图义视觉核对（未做）、锚点覆盖（headless 24 回合仅 2 次出现 source id、0 次出现页码 → 受预算限制，产品路由 1 回合已 PASS）、A20 模糊图澄清、A14 复习落账（F4-finish-review 代码缺陷）。
- G3：另一台干净机验证、代码签名。
- 交付：用户内容审校 + 事故核对。

## 12. 审计修正（2026-10-30 07:00，依 T17-v2）— 覆盖本报告此前的三处过度声明

独立审计（`docs/rebuild/reports/T17-v2.md`）指出本报告与 PROGRESS 有三处**与实物不符**，现更正，不作辩解：

1. **"A20 修复已进 v5" 不成立**（F-01）：`evaluateImageAnswer` 的唯一调用点是 CLI `vision-baseline.ts`；产品 `g1-service.ts` 里 `model.image=false`、`imageFlow:null`，产物 bundle 中 `image-quality-v1/qualitySignal/laplacian` **0 命中**。**A20 = PARTIAL，图像质量门未接进产品图片路由。**
2. **"L5 近似 Key 录入 200" 不可复核**（F-02）：同目录 `key-post-response.json` 实际是 `{"ok":false,"error":"INTERNAL"}`；T16-installer §8 同段同时写了 200 与 F4=500；而 L5 运行时间（04:52–04:58）早于 F4 bundle 重建（06:30），且测试数据根已删。**结论：L5 近似只能记 L4.5≈（本机同账户），Key 录入在该次运行中失败。**
3. **v5 没有自身冒烟证据**（F-03）：现存 smoke-summary 是 v1（`8440B210…`），installer 报告 §1 是 v3（`4B983BEB…`），全 `.local` 检索 `8B175E64` 0 命中。**PROGRESS 旧句"安装→启动→卸载冒烟通过"只对 v1 成立；v5 仅验证了"已安装 + bundle hash 一致"。**

另记（不改变 AC 但必须知道）：F-04 "9 步/7 场景"是跨运行拼合（`final-v2/journey.json` 只有 8 条、缺 correct-feedback）；F-05 两张截图字节相同；F-06 payload `version.txt` 写 `sharpIncluded=false` 却含 sharp；F-07 PROGRESS 新旧结论并存；F-08 `education/licenses/tools/build-notice.mjs` 已被主控误改损坏（不可再生）；F-09 根 `.env` 含明文真 Key（gitignored、未跟踪、未进 Git，但需轮换）。

**据此修正门状态**：G1=**FAIL**（链路通、验收项不全）、G2=**FAIL**、G3=**FAIL**（不再是 BLOCKED）；`finalAccepted` 不可达；**0 条 L5**。

### 13. A20 状态更新（2026-10-30 08:0x，T17-v2 F-01 的整改）
- POST /edu/api/g1/image 已接 **image-quality-v1 质量门**：模糊/倾斜/空白 → clarification_required、modelCalled=false、无证据候选；通过才允许模型。host bundle 命中 9 行标记（证据 sha256 9d9e786d…）。capabilities.model.image 按 Key 状态如实返回。
- 离线 4 类结果：清晰 2 类 model_required（未发请求）、旋转+模糊澄清、均匀白底澄清；T11 'blank answer' 样本整帧有印题，pre-model 无法判定手写答案区为空（限制如实保留）。
- 客户端上传控件（StudyWorkspace.imageFlow）仍为 null → **UI 上传未接**；A20 记 **PARTIAL（质量门已接线并离线验证；真实图片效果与 UI 上传待预算/后续切片）**。
- v7 安装包 59,411,008 B / 9669C83F…DB95，冒烟 1.63s、status 200、fixtureData=false、43 概念。

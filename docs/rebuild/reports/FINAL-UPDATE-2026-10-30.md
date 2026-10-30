# 交付状态更新（2026-10-30 23:1x，主控实测）

本文件是 `FINAL-REPORT.md` 与 `T17-v2.md` 之后的最新状态，**以后续更新为准**（旧报告中的 AC 计数已被本轮证据覆盖）。

## 1. 本轮新增的确定结论

| 项 | 结论 | 证据 |
|---|---|---|
| 内容发布 | **published**（人类 curator = 用户本人，`docs/rebuild/CURATOR-APPROVAL-2026-10-30.md`）；`validate-pack` PASS、`selfcheck` 46/46、`content:validate`=0、contentHash `278bb338…f88a` | `education/.local/evidence/T14/publish-20261030/publish-result.json` |
| 产品正式理解判断 | **生效**：安装版 `/edu/api/status` 返回 `dto.trustMode="published"`（v9 起；此前为硬编码 candidate） | `education/.local/evidence/T16/v9-smoke/v9-smoke.json` |
| A14 复习落账 | **PASS**：`finish-review revision=1` 一次成功（无 UNAUTHORIZED/STALE_REVISION），`outcome=needs_support`、`understanding` 未升 supported，**杀进程重启后记录仍在** | `education/.local/evidence/T15/budget-20261030T2050/a14-*` |
| 产品路由锚点 | **4/4 回合 100%** 同时出现 source id + PDF 页 + 印刷页；场景覆盖 3/5（S1 被 F5 阻断、S5 到预算上限未跑） | `…/anchor-S*.json`、`anchor-summary.json` |
| A20 图片 | **PARTIAL**：旋转 14°+模糊 6× 被独立质量门**短路**（`modelCalled=false`、29 ms、0 调用，Laplacian 4.2<80）；管线 3 次真实调用判对/判错/澄清。**但产品路由只做门不做判分**（F7），学生拿不到图片判分 | `…/a20-probe`、`a20-image`、`a20-route-0*` |
| F5 重启首启崩溃 | **已修**：session id 分配改为扫描 DSH session store（+时间戳回退），resume TypeError 转 `SESSION_RESUME_FAILED`，`tutor-service` 兜底重试一次；零调用冒烟里同数据根重启后连续两次 start 成功（session.3 / session.5） | `education/.local/evidence/T13/f5-fix/smoke-summary.json` |
| F6 disclosure 失真 | **已修**：新增 `answerDisclosed` 信号与 `detectAnswerDisclosure`，模型实际披露时补标 `decision.disclosure`/`session.disclosure`/审计，证据按 assisted 归类 | `packages/tutor/test/disclosure-signals.test.ts`（6 项） |
| v10 安装包 | **59,409,767 B**，SHA-256 `26B5FF603C776084C7464869984ADFF21FECCE6BC123E7DA6F875F9367A4AB48`；payload 34,492 文件；0 个 `.vbs`；`sharpIncluded=true` | `education/dist/SproutAsk-Setup-x64.exe` |
| 质量门（冻结后） | `contract:lock:generate` → 453 files / 21 commands；`verify`=**OK**；`test:contracts`=**0**；`typecheck`=0；`test`=0 | 本机实测 |

## 2. 仍缺（不得计为通过）

1. **F7 图片判分未接进产品路由**（A20 只能 PARTIAL）：安装包内无 `evaluateImageAnswer`，UI 兜底"图片识别服务未接线"。
2. **锚点场景 S1（核心误解）/S5（u2.ch3 抽样）未跑**：真实调用预算 **171/180**，仅剩 9 次。
3. **图义视觉核对（65+8 条）未做**；**版次/印次/ISBN 仍 unverified** → G2 内容门仍有缺口。
4. **G3**：未签名（用户决定不买证书）；**未在另一台干净机验证**；便携产物未单独交付。
5. 学情有效性（学习实验）**未做**，任何"提升理解/成绩"的说法都没有证据。

## 3. 门状态（本文件为准）

- **G1** = PARTIAL：plumbing L3 + 产品 UI 7/7 + published 理解判断生效；缺 F7 图片路径与 S1/S5 场景。
- **G2** = FAIL/PARTIAL：人类 curator 已发布、A14 PASS、锚点 100%（4 回合）；缺图义核对、版次核对、A20 全链路、S1/S5。
- **G3** = PARTIAL：v10 产物与 L5 近似；缺干净机、签名（无证书）。
- **`finalAccepted` 仍不可达。**

## 4. 交付物清单

- 安装包：`education/dist/SproutAsk-Setup-x64.exe`（v10）
- 报告：`docs/rebuild/reports/T13.md`（含 §F5/F6）、`T15.md`（§增补预算复验）、`T14.md`（§人类审校发布）、`T16-installer.md`、`T17-v2.md`、`REVIEW-01.md`
- 审批与事故：`docs/rebuild/CURATOR-APPROVAL-2026-10-30.md`、`docs/rebuild/SECURITY-INCIDENT-2026-10-30.md`
- 进度：`docs/PROGRESS.md`（§12–§14 与末行追加）

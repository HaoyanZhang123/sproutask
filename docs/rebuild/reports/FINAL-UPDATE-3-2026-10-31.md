# 交付状态更新 3（2026-10-31 02:2x，主控实测）

覆盖 `FINAL-UPDATE-2-2026-10-31.md`，**本文件为最新口径**。

## 本轮完成（用户指定的第 1、6 项）

### 1. 图义视觉核对（抽样，如实统计）
- 抽样 **8/73（覆盖率 11%）**，覆盖 7 个不同章（U1 4 条 / U2 4 条），每条只发"该图注所在单页的裁剪带"给视觉模型。
- 结果：**一致 7 / 不一致 0 / 无法判断 1**（p101「图2-28 鸟体内的气囊」裁剪带未覆盖图主体，属工具限制，非图文不符）。
- 判定主体 = **会话内视觉模型（agent-vision-model）**，不是人眼签字；**其余 65 条仍未做视觉核对**。
- 证据：`education/.local/evidence/T14/figure-audit/visual-sample.json`（sha256 `49b42e46…17d9`）+ `visual-sample/crops/` + 可复跑脚本；结论已写入 `docs/rebuild/reports/T14.md` §图义视觉抽样核对。

### 6. NOTICE 生成器重写 + 文案自洽（F-08）
- 旧 `build-notice.mjs` 确证损坏（BOM + GBK 乱码，`node --check` SyntaxError）→ 保留为 `build-notice.mjs.broken` 存证。
- 新 `build-notice-v2.mjs`：随包状态**以 payload 实测为准**，带三条硬断言（未声明裁剪即退出、sharp/@img 必须随包、LGPL 全文标记必须在）。
- 结果：**558 = 546 随包 + 12 裁剪**；**sharp / @img/sharp-win32-x64 均为 `yes`**，全文不再有"sharp 已裁剪"；EXCLUDED.md 只列 12 个真裁剪包并单列"sharp 不在其中"；LGPL-3.0 全文（`texts/9a7e34fb…`，316,506B）+ libvips 源码获取 + DLL 可替换说明在 NOTICE §3.1。
- 幂等：连跑两次四文件 sha256 一致、`--check` exit 0；`verify-licenses` pass=true、558 行、unmatched=0。

## v14 安装包（主控已装并冒烟）

- 产物：`education/dist/SproutAsk-Setup-x64.exe` — **59,434,319 B（56.7 MB）**
- SHA-256：`0FC5DF1828265D0ED74E20F89CC7DDC0D3C55F5AC83E6DE3DF39A2E042D9C014`
- payload：34,494 文件 / 408,540,451 B；`scan-payload` OK；`.vbs` = 0；licenses 随包（与源 hash 一致）
- 主控冒烟：安装 exit 0 → 启动 **1.75 s** → status **200** → `fixtureData=false` → **`trustMode=published`** → 43 概念；安装目录内 `licenses/NOTICE.md` 的 sharp 行实测为 **`yes`**
- 证据：`education/.local/evidence/T16/v14-smoke/v14-smoke.json`
- 质量门（冻结后）：contract-lock **OK（456 files / 21 commands）**、`test:contracts`=0、`selfcheck` PASS、`content:validate`=0

## 仍未完成（最终清单，不缩水）

1. **图义视觉核对 65/73 未做**（需另批预算或人眼）；已抽样 8 条，其中 1 条需放大重裁后再判。
2. **版次/印次/定价/开本** = `null + unverified`（版权页小字未识别，未用常识推算）；已知 **ISBN-13 = 978-7-107-38263-5**、出版社 = 人民教育出版社。
3. **UI 视觉走查**：无真实浏览器/设备截图；UI 仅 happy-dom 离线断言。
4. **图片真机**：JPEG/手机拍照、canvas 压缩、澄清后重试与 image attempt 对齐未验证。
5. **干净机 L5**：只有本机近似（无开发 PATH、独立数据根），**没有第二台机器**。
6. **未签名**（用户决定不买证书）→ SmartScreen 会提示未知发布者。
7. **DSH 无回合取消接口**：回合预算中断只是"不再等待"，被放弃回合仍会在后台跑完（需 host 侧 `agent/turn-stopping` 钩子）。
8. **学习效果实验未做**，不得声称提升理解/成绩。

## 门状态（最终）

- **G1 = PARTIAL**（plumbing L3 + 产品 UI 7/7 + published 生效 + 图片 API/UI 均通；缺图片真机与视觉走查）
- **G2 = FAIL/PARTIAL**（内容已 published、A14 PASS、A20 API 4/4、锚点 4/5 回合、图义抽样 8/73；缺图义全量、版次核对、S5 修后真实复测）
- **G3 = PARTIAL**（v14 产物 + L5 近似；缺干净机、签名）
- **`finalAccepted` 不可达。**

真实模型预算：**193/194**（剩 1 次，建议留给 p101 那条放大重判）。

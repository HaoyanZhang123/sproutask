# 交付状态更新 2（2026-10-31 01:2x，主控实测）

覆盖 `FINAL-UPDATE-2026-10-30.md` 之后的变化，**本文件为最新口径**。

## 新增完成

| 项 | 结论 | 证据 |
|---|---|---|
| S5 网络失败 | **根因非网络**：DSH 无单回合预算 → 14 次工具往返后 assistant 末步只有 reasoning；旧逻辑只取最后一条 assistant → 空串 → 被 `localRuleTurn()` 静默替换并丢弃已解析来源。已修：单回合预算（45s / 10 工具）+ 结构化错误 `TURN_BUDGET_EXCEEDED`/`TURN_TOOL_CAP_EXCEEDED`/`TURN_NO_TEXT` + 保留 toolNames/sourceRefs/PDF 页 + 不再静默回落 + 并发回合拒绝。8 新用例，0 模型调用 | `education/.local/evidence/T15/s5-fix/root-cause.md` |
| 图片入口 UI | 选图/拍照入口、选择≠发送（先预览再确认）、取消/重传、类型与大小校验、质量门澄清与判分展示、澄清只记 pending 不写成绩 | `docs/rebuild/reports/T12.md` §图片上传入口 |
| 判分落库 + 幂等 | `attempt.submitted` + `assessment.committed` 两阶段；`attemptOutcome` 不再 null；同图重复提交命中既有 attempt（`attempt.image.<sha256>`），不二次调模型、不新增 journal 行 | 同上；`runtime/test/image-route.test.ts` |
| F8 锁自愈 | TTL 120s 可配；pid 死/超时/不可解析锁分级回收 + 心跳 + `lock.reclaimed` 审计 | `docs/rebuild/reports/T02.md` §锁自愈 |
| 图注文本/页位核对 | 73 条：一致 51 / 存疑 22 / 视觉待核 73；pdfPage 越界 0、printedPage 冲突 0 | `education/.local/evidence/T14/figure-audit/` |
| 版次/ISBN | **ISBN-13 978-7-107-38263-5**（封底双处互证）；出版社=人民教育出版社；版次/印次/定价等 **null+unverified** | `education/content/biology-7a/source/copyright-fields.json` |
| v13 安装包 | **59,420,154 B**，SHA-256 `9FED9C49F9C1CB9BC87026FFB4E3D48805E889751D24BDF8ADE0AD11A65B32FE`；payload 34,492 文件、扫描 OK、`.vbs`=0 | `education/.local/evidence/T16/v13-smoke/` |
| v13 冒烟（主控） | 安装 exit 0；启动 **1.66 s**；status **200**；`fixtureData=false`；**`trustMode=published`**；43 概念；安装包 host bundle 含 `evaluateImageAnswer`/`attempt.image` 标记 | 同上 |
| 质量门（冻结后） | contract-lock **OK（455 files / 21 commands）**；`test:contracts`=0；`typecheck`=0；`test`=0（**642 tests**）；`selfcheck` PASS；`content:validate`=0 | 本机实测 |

## 仍未完成（诚实清单）

1. **图义视觉核对 73 条**（需人眼；已有按页工作表 `figure-audit/visual-pending.md`）。
2. **版次/印次/定价**人工核对（OCR 未读到，未推算）。
3. **UI 视觉走查**（无真实浏览器/设备截图；UI 仅 happy-dom 离线断言）。
4. **图片真机验证**：JPEG/手机拍照、canvas 压缩、clarification 与 image attempt 的 retry 对齐。
5. **干净机 L5**：本机近似已做（无开发 PATH、独立数据根），但**没有第二台机器**。
6. **签名**：用户已决定不买证书 → 未签名是已知限制。
7. **DSH 无回合取消接口**：预算中断只是"不再等待"，被放弃回合仍会在后台跑完（需 host 侧 `agent/turn-stopping` 钩子）。
8. **NOTICE 文案**：`education/licenses/NOTICE.md` 正文仍写 sharp "已裁剪"，与"随包"矛盾（生成器已损坏，需重写后再生成）。
9. **学习效果实验未做**。

## 门状态

G1 = PARTIAL（plumbing/UI/published/图片 API 均通；缺图片真机与视觉走查）
G2 = FAIL/PARTIAL（策划已发布、A14 PASS、A20 API 4/4 PASS、锚点 4/5 回合；缺图义视觉、版次核对、S5 修后复测）
G3 = PARTIAL（v13 产物与 L5 近似；缺干净机、签名）
**finalAccepted 不可达。**

预算：真实模型累计 **185/194**。

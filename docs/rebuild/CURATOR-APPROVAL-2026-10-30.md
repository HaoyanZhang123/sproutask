# 人类 curator 审校记录（用户本人，2026-10-30）

## 声明来源

用户在本次会话中明确答复：

> “1.审核过了，没问题”

审校对象：`docs/rebuild/CURATOR-WORKSHEET.md`（全册内容包 `pack.biology-7a.observation@2.0.0`，2 单元 / 7 章 / 22 节 / 43 概念 / 88 活动 / 43 rubric / 44 关系 / 281 出处）。

- 审校者：**用户本人（人类）**。不得写成"教师/专家/审核员"。
- 审校方式：按工作单逐条核对（概念解释、易错点、出处 PDF 页/印刷页、rubric、活动答案键、先修关系依据）。
- 时间：2026-10-30（Asia/Shanghai）。
- 结论：**通过（无修改要求）**。

## 该记录能支持什么

- 允许按 `PublishRegistry` 规则写入 `human_curator` 的 `curator_checked → published` 记录，并以 `actorKind=human_curator`、`scopeChecklistSatisfied=true` 调用 `publish`。
- 允许内容包从 `candidate` 推进为 `published`，从而让正式"理解证据"判断生效（G1-formal-learning）。

## 该记录不能支持什么（必须保留的限制）

- **图义视觉核对**（65+8 条图注的视觉/科学含义核对）**未单独进行**；如需对外声称"图义已核"，必须另做。
- **版次/印次/ISBN/全书印刷页数**仍为 `unverified`（OCR 未能读清版权页），不能声称已完成版本核实。
- 不构成"学习效果实验"或"专家/教师认证"。
- 代码签名：用户已明确 **不购买证书** → 安装包未签名是已知限制。

## 待执行的机械动作（本次会话未完成）

因执行该动作的子智能体连续失败（无输出退出），以下步骤尚未落地，需在下一轮/新会话执行：

1. 在 `education/content/biology-7a/review/review-ledger.json` 追加包级与逐实体的 `human_curator` 记录（actorLabel 引用本文件）；
2. 调 `@edu/knowledge` 的 `PublishRegistry.publish({actorKind:'human_curator', scopeChecklistSatisfied:true})` 发布（先首节 partial，再全册）；
3. 重跑 `validate-pack` / `selfcheck` / `content:validate`；
4. 重打安装包（不携带任何 `.vbs`，快捷方式指向 `launcher.cmd`）。

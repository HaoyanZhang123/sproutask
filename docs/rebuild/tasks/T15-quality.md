# T15 验证教学质量与全册集成

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：验证教学质量与全册集成。需求：R03、R04、R06、R07、R08、R10、R11、R18。验收：A08、A09、A10、A13、A14、A19、A20、A30、A34、A35，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T13、T14；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：G1已通过与全册包已发布；全量检查屏障；获准live预算覆盖计划，不复用历史绿。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[01-product-contract](../01-product-contract.md)、[02-user-flows](../02-user-flows.md)、[07-acceptance](../07-acceptance.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/tests/education/`
- 计划路径：`education/tests/e2e/`
- 计划路径：`education/scripts/`
- 计划路径：`education/package.json`
- 计划路径：`education/pnpm-lock.yaml`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T15.md`、`docs/rebuild/requests/T15.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

G2：全册覆盖独立审查、两轮固定真实教学场景、每章抽样、真图像反馈及全部软件回归通过；L5产物检查仍归T16。

可提供门：G2。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A31/A32及其他L5→T16；最终全矩阵→T17。

附加允许写入：`education/.local/evidence/T15/`、`education/.local/cache/T15/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。使用说明写`education/docs/`。

## 必须完成的步骤

1. 独立核对真实目录与coverage，检查全册来源/图义/关系和核心概念活动，不能作者自评代独立审查。
2. 固定12类教学场景/期望/来源后两个独立轮次真实评测，每章至少一次真实互动；失败保留人工判读，修复不删题/放宽口径。
3. 补全G2及真图片语义评价、无视觉模型/模糊识别的行为；复核已辅助答案不升级理解，自评/复习完成不冒充掌握。
4. 全量UI/本地数据/权限/失败恢复回归，记录真实视口和可访问性；若需修改产品模块交原owner返工，不越scope。
5. 编写正确的产品限制与用户使用说明初稿；AI审校、模型行为与学习收益实验分开。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T15 / test:task T15及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T15.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

同一失败持久计数。无真实预算不能把mock通过算L4；阻断学科错误/伪来源/瞎判图必须修复。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

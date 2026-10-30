# T17 独立最终审计并交回主对话

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：独立最终审计并交回主对话。需求：R01、R02、R03、R04、R05、R06、R07、R08、R09、R10、R11、R12、R13、R14、R15、R16、R17、R18。验收：A01、A02、A03、A04、A05、A06、A07、A08、A09、A10、A11、A12、A13、A14、A15、A16、A17、A18、A19、A20、A21、A22、A23、A24、A25、A26、A27、A28、A29、A30、A31、A32、A33、A34、A35、A36，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T16；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：T00–T16全套被接受报告、真实教材local证据、最后代码/内容/产物指纹，审计owner应不同于主要实现owner。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[01-product-contract](../01-product-contract.md)、[02-user-flows](../02-user-flows.md)、[03-evidence](../03-evidence.md)、[04-dsh-integration](../04-dsh-integration.md)、[05-data-contracts](../05-data-contracts.md)、[06-system-design](../06-system-design.md)、[07-acceptance](../07-acceptance.md)、[08-execution](../08-execution.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`docs/rebuild/reports/T17.md`
- 计划路径：`docs/rebuild/FINAL-REPORT.md`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T17.md`、`docs/rebuild/requests/T17.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

独立按07全量AC的最终级别逐项验证，通过才给finalAccepted；不能用阶段门或接口可消费代替最终PASS。

可提供门：finalAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：无延期，未达到最终证据等级一律FAIL/BLOCKED/NOT_RUN，不能finalAccepted。

附加允许写入：`education/.local/evidence/T17/`、`education/.local/cache/T17/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 独立读取所有报告和现状，逐项重核AC与最后hash绑定；过期证据、skip、blocked不算通过。
2. 抽查真实DSH闭环、全册覆盖、三轴状态和失败恢复；实际运行打包产物的代表路径，不能仅摘抄实现者结论。
3. 核本地/云数据边界、账户准入、原文与秘密包排除、source license、用户数据未破坏；检查未解决阻断问题。
4. 给主控FINAL-REPORT：逐需求结果、AC矩阵、启动使用、产物位置/hash、覆盖分母、已知局限、未测教育实证、剩余外部输入和回此对话材料。

## 验证与交回

独立执行必要代表性运行与证据复核；只读业务代码，遇失败交原owner。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T17.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

只写审计产物，发现实现问题交原owner返工后再验；主控负责PROGRESS与最终总结，不自行修业务代码。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

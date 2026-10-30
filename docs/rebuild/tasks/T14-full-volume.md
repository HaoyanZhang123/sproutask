# T14 完成七上全册概念内容与来源审校

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：完成七上全册概念内容与来源审校。需求：R03、R04、R05、R06、R07、R10。验收：A08、A09、A10、A11、A19，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T05；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：获准真实全册PDF与T05模板、知识/导入校验器；接续T05内容目录独占写权。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[01-product-contract](../01-product-contract.md)、[03-evidence](../03-evidence.md)、[05-data-contracts](../05-data-contracts.md)、[07-acceptance](../07-acceptance.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/content/biology-7a/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T14.md`、`docs/rebuild/requests/T14.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

contentReadyFull：真实全册冻结inventory/coverage、概念/来源/图义/活动/rubric/关系审校完整，无阻断缺口；发布full_volume+complete，交G2独立复核。

可提供门：contentReadyFull。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A08真实UI、A09/A10独立全册检查、A19实际图示→T15；实际产物→T16。

附加允许写入：`education/.local/evidence/T14/`、`education/.local/cache/T14/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 从真实封面版权页目录冻结全册coverage-manifest，逐页处理状态和纳入/排除概念理由；不预填章名/概念数。
2. 按章小批制作所有目标概念的定义边界/目标/出处/常见误解/基础与变式活动/rubric/重要图示，跨节概念去重、同名不同义分开。
3. 逐项来源对照审核关键事实和依赖推断，图义不能靠OCR文字替代；AI/人工角色真实记录，未决不得发布全册就绪。
4. 全量校验所有引用、页码、先修DAG、活动/rubric可执行、覆盖分母及范围排除；修订原文在local，Git只自有结构。
5. 发布full_volume+complete版本并交完整差异、兼容映射、审校ledger与coverage；不得以增删分母达到100%。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T14 / test:task T14及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T14.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

允许按章开只读/内容子任务但主控分配互不重叠文件；整包ID/关系合并由T14 owner串行负责，不能多个内容agent共改manifest。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

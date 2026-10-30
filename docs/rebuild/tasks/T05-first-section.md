# T05 制作首节真实生物内容包

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：制作首节真实生物内容包。需求：R03、R04、R06、R07。验收：A08、A10，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T03、T04；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：获准真实教材PDF及封面版权页目录可核实；现有旧OCR只作线索、不能替原图。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[01-product-contract](../01-product-contract.md)、[03-evidence](../03-evidence.md)、[05-data-contracts](../05-data-contracts.md)、[07-acceptance](../07-acceptance.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/content/biology-7a/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T05.md`、`docs/rebuild/requests/T05.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

真实PDF版本和来源核实；首节scope内概念、两类活动、rubric、来源对照清零，published partial可被G1消费；不是全册完成。

可提供门：contentReady。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A08真实UI→T13；全册A09/A10→T14/T15。

附加允许写入：`education/.local/evidence/T05/`、`education/.local/cache/T05/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 在真实PDF确认人教版/册次/修订版信息和首节（优先既有细胞的生活）来源，建立本地input-manifest，原PDF不入库。
2. 为声明小节建立概念inventory、定义边界/目标/误解/来源/必要图示、基础与变式活动、rubric；教学阈值标启发式。
3. 按原页逐项核对关键事实、页码、图义和关系，记录检查者AI/人工与未决；不冒称教师专家审校。
4. 发布scope=partial且coverageStatus=partial首节包，提供G1真实样例；对全册目录仅登记已核实部分，不虚填总数。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T05 / test:task T05及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T05.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

T05完成后将内容目录写权交T14。无原PDF时可备fixture草稿但真实验收BLOCKED，不能发布为已核首节。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

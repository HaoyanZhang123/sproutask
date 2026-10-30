# T04 实现目录、概念图与内容发布服务

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：实现目录、概念图与内容发布服务。需求：R03、R04、R05、R16。验收：A07、A08、A11、A28，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T01；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：冻结ContentPack/SourceRef/Relation；使用共同自有fixture开发。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[05-data-contracts](../05-data-contracts.md)、[06-system-design](../06-system-design.md)、[07-acceptance](../07-acceptance.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/packages/knowledge/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T04.md`、`docs/rebuild/requests/T04.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

自有fixture下树图/引用/发布范围/候选与版本映射校验通过，公开查询和source port可用；真实页面联动后补。

可提供门：implementationAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A07/A08真实材料与UI→T05/T09/T13/T14；A11全册关系→T14/T15。

附加允许写入：`education/.local/evidence/T04/`、`education/.local/cache/T04/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 实现目录树和多placement概念、先修有向图与related关系；先修DAG检查、悬空/自环/重复/错页码/跨版本拒绝。
2. 实现来源查询与受控页图定位、局部邻域有界查询、搜索和状态投影接口；不把章节顺序硬推先修。
3. 实现candidate校验/显式试用与published分离；partial首节可范围内发布，full_volume complete才可全册标记。
4. 实现内容包不可变发布、差异及CompatibilityMap审核，旧证据不因同ID自动迁移；覆盖台账和内容验证CLI交共享脚本owner接入。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T04 / test:task T04及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T04.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

不得写教材实体数据目录（T05/T14），只负责机制；不调用旧核心作为新知识真相。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

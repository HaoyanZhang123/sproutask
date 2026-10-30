# T12 实现学习复习工作区与活动恢复

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：实现学习复习工作区与活动恢复。需求：R06、R07、R08、R09、R12、R13、R17。验收：A13、A14、A18、A21、A22、A23、A29，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T07、T08、T09、T10、T11；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：所有相关公开port/组件已接受；content使用fixture与真实首节分别测试。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[02-user-flows](../02-user-flows.md)、[05-data-contracts](../05-data-contracts.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/client/study/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T12.md`、`docs/rebuild/requests/T12.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

学习复习UI消费前置公开port，mock/本地服务下主旅程、草稿/取消/版本/图示组件和接口测试通过；真实DSH闭环由T13补。

可提供门：implementationAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A13/A14/A21真实模型→T13/T15；A22实际exe→T16。

附加允许写入：`education/.local/evidence/T12/`、`education/.local/cache/T12/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 实现材料中心工作区、learn/review范围与活动容器；提示/解释/示范/跳过/结束可见，支持文字等价意图。
2. 接通提交前保存原答、反馈pending/取消/失败、正式提交与草稿分离；切concept/mode前保留原session，迟到结果不串写。
3. 实现复习先回忆及按证据调整；完成学习/复习收尾与理解状态分别显示，不凭退出完成。
4. 实现图片确认反馈与出处往返、首页恢复cursor/草稿/焦点、内容版本不兼容提示；无Key离线可读不假反馈。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T12 / test:task T12及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T12.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

不能用本地React/Vue状态假装服务持久化；production必须真实教育API。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

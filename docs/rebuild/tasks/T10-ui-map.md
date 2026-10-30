# T10 实现教材树与局部概念地图

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：实现教材树与局部概念地图。需求：R05、R08、R09、R13。验收：A11、A12、A18、A23，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T04、T06、T08；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：knowledge查询、learner投影、shell组件；自有500概念fixture。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[02-user-flows](../02-user-flows.md)、[05-data-contracts](../05-data-contracts.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/client/map/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T10.md`、`docs/rebuild/requests/T10.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

自有500概念fixture及真实知识/进度port测试通过，树图/状态/键盘/布局与性能记录齐；真实教材互动后补。

可提供门：implementationAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A11全册→T14/T15；A18最终实时更新→T13；A23集成视觉→T15。

附加允许写入：`education/.local/evidence/T10/`、`education/.local/cache/T10/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 实现目录树/局部关系图切换、搜索/筛选、跨章展开、概念详情及出处/证据/学习复习入口。
2. 区分先修方向、相关关系、目录归属及依据，不按关系硬锁学习；同概念多节不重复计数。
3. 显示三轴中文与自评，候选/partial/证据过期各自标识，不展示假精确掌握率。
4. 实现键盘列表/关系文字替代、缩放适配；测试500节点局部查询和低分辨率可用性，记录真实性能。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T10 / test:task T10及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T10.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

不能把前端节点颜色当状态真相；不直接写journal。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

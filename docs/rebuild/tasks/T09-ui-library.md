# T09 实现教材导入、任务进度与来源阅读界面

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：实现教材导入、任务进度与来源阅读界面。需求：R02、R03、R13、R17。验收：A06、A07、A08、A23、A29，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T03、T08、T04；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：importer与safe asset API；shell页面注册契约；published/candidate机制按T04消费。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[02-user-flows](../02-user-flows.md)、[05-data-contracts](../05-data-contracts.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/client/library/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T09.md`、`docs/rebuild/requests/T09.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

在T03/T04服务或明确受控测试适配器下，导入进度/候选/阅读返回组件测试通过；production API factory已交，T13接真实宿主。

可提供门：implementationAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A08真实模型回答出处与全册→T13/T15；其余真实宿主→T13。

附加允许写入：`education/.local/evidence/T09/`、`education/.local/cache/T09/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 实现教材库/文件选择/metadata确认、匹配与candidate提示，展示parser真实进度/取消/恢复/失败重试。
2. 实现PDF页/图示来源阅读，PDF序与印刷页分别显示，定位越界/缺源文件不假跳页；回到原活动保留草稿/焦点。
3. 候选试用需显式选择且始终未核实标记，不能点确认就变基准；partial不能显示全册就绪。
4. 测试重复导入、断网本地步骤、取消迟到、缺文件、无权限、长任务中重启；生产无fixture硬编码。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T09 / test:task T09及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T09.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

不改shell或runtime公共入口；同版扫描差异由服务判定，不由UI猜。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

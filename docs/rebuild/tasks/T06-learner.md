# T06 实现证据、三轴进度与复习策略

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：实现证据、三轴进度与复习策略。需求：R07、R08、R09、R15。验收：A14、A15、A16、A17、A18、A25，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T02；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：冻结domain与T02存储；先用自有rubric及clock测试，真实rubric后接T05/T14。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[05-data-contracts](../05-data-contracts.md)、[07-acceptance](../07-acceptance.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/packages/learner/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T06.md`、`docs/rebuild/requests/T06.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

纯规则+T02真实日志测试通过，三轴/自评/assisted/反证/时效/候选/版本与日程行为可被后继消费。

可提供门：implementationAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A14真实教学→T13/T15；A17/A18真实UI→T08/T10/T13。

附加允许写入：`education/.local/evidence/T06/`、`education/.local/cache/T06/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 实现Learning/Understanding/Review独立投影，自评独立；取消/跳过不判错、活动完成不直接掌握。
2. 实现证据规则、assisted记录、低可信pending、不足证据unassessed、反证回落与时间stale；所有判断可解释且有版本。
3. 实现可配置且版本化的1/3/7日复习默认、提前复习/暂缓、队列去重与时区边界；不宣称科学最优。
4. 实现首用已学自述与诊断建议、按去重conceptId聚合；candidate试用不写正式理解结论。
5. 测试内容包更新/拆分合并/rubric变更映射、两阶段提交幂等、重放投影一致。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T06 / test:task T06及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T06.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

不运行LLM、不写UI；任何规则门槛不得伪称已做教育实证。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

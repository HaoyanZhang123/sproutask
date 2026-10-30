# T11 实现受控图示和多形式批改

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：实现受控图示和多形式批改。需求：R10、R11、R14、R17。验收：A19、A20、A21、A24、A29，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T03、T04、T06；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：受管图片、实际模型能力、知识来源和learner证据接口；真图像调用预算另需获准。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[02-user-flows](../02-user-flows.md)、[04-dsh-integration](../04-dsh-integration.md)、[05-data-contracts](../05-data-contracts.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/packages/visuals/`
- 计划路径：`education/client/visuals/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T11.md`、`docs/rebuild/requests/T11.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

受控DiagramSpec、规则批改、图片确认和能力降级的本地/模拟测试通过，提交GradeResult和证据port；真实识图L4未验须保留global AC未通过。

可提供门：implementationAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A19/A20真实科学/图片评价→T13/T15；A21真实工作区→T12/T13。

附加允许写入：`education/.local/evidence/T11/`、`education/.local/cache/T11/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 实现DiagramSpec受控渲染、结构标注/关系题与等价键盘表单；禁止任意JS/HTML执行。
2. 实现文字/选择/标注规则批改和开放回答模型反馈，GradeResult带依据/不确定性，证据候选经learner验证后落盘。
3. 实现图片预览→明确发送→识别确认/修订→反馈；原图/识别/学生修订/评价分别留痕，修订触发旧错误评价失效。
4. 检测模型image capability，无视觉/模糊/空白/旋转/手写/提示注入明示限制或澄清；低可信不得判学生错。
5. 用预先固定清晰正确/明显错误/模糊图及代表手写结构图进行真实模型验证，记录模型/尺寸变换/费用/判读，不挑成功样本。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T11 / test:task T11及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T11.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

上传与OCR存在不等于理解图像；模型执行失败不能退回伪造批改。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

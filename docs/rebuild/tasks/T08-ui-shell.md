# T08 实现教育界面壳、账户与首页记录

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：实现教育界面壳、账户与首页记录。需求：R12、R13、R14、R15。验收：A03、A17、A22、A23、A24、A33，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T01；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：T01root/page registry与safe API DTO；接口可先用冻结fixture，生产必须真实API。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[02-user-flows](../02-user-flows.md)、[04-dsh-integration](../04-dsh-integration.md)、[05-data-contracts](../05-data-contracts.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/client/shell/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T08.md`、`docs/rebuild/requests/T08.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

教育shell/页面registry/身份状态/首页记录组件，在冻结API fixture上运行UI测试及键盘空错态通过；真实账户与重启产物后补。

可提供门：implementationAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A03账户→T13/T16；A22产物重启→T16；各页面真实集成→T13。

附加允许写入：`education/.local/evidence/T08/`、`education/.local/cache/T08/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 建立教育root、导航/布局token、首页三入口、记录/证据页、首用匿名档案与自述范围；移出开发入口。
2. 重做模型登录/设置状态，正当账户授权与API Key分离，无模型凭据也能读本地内容；更换模型账号不删学情。
3. 实现继续上次准确cursor、空态/错误/离线/保存失败；导出删除界面分别说明影响并确认。
4. 提供后续library/map/study/visuals页面挂载点和公共组件接口；支持键盘、窄窗、颜色文字双标。
5. 验证Host安全仍由后端，客户端无token/堆栈/私密路径；不只靠隐藏菜单裁权限。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T08 / test:task T08及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T08.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

不得全局改其他client包；主控T13接功能路由，T08公共组件变更走请求。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。

# 运行架构与实施约束

> 本文件定义后续实现布局，当前不存在这些新模块。目标/页面见[产品契约](01-product-contract.md)、[使用流程](02-user-flows.md)；实体/接口以[公共契约](05-data-contracts.md)为准；DSH已知边界见[内核接入](04-dsh-integration.md)。

## 1. 架构决策

ADR-R01：DSH负责真实会话、模型路由、工具调度和Skill加载；旧Agent循环不得成为新产品的隐藏主引擎。每次真实学习必须能由宿主执行记录追到DSH session、模型调用和教育工具结果。mock只用于测试，不能作为“已接入DSH”证据。

ADR-R02：教育新实现隔离在工作区内education/，保持旧src/content/tools及其历史可回查。不在本次交接阶段创建业务代码。后续T00/T01可按卡创建该顶层目录。旧renderer→main→core只约束旧代码；新架构为client→authenticated API→application services→pure domain，DSH adapter与I/O均在宿主侧。纯domain不能依赖DSH/Electron/UI；客户端不能读秘密、任意文件、journal。

ADR-R03：可构建的官方固定来源优先。安装版asar只作静态证据，不是可修改工作树、不可当可再分发SDK。T00选择官方固定版本包/源码适配；固定commit或完整package lock、许可证、运行环境、实际API。若只有浮动或不可合法重建来源，禁止以复制安装目录掩盖缺口。不得改用户正在用的DSH安装、账户存储或当前GUI。

ADR-R04：默认Windows本地单人桌面；浏览器UI采用DSH支持的client root plugin，宿主选择在T00/T01冻结。框架、root注册顺序、静态bundle生成方式依实际版本，不继续强制旧Vue。标准用户权限可运行；会话在本机loopback；不添加局域网/公网暴露、班级云端或遥测。

ADR-R05：内容包不可变、个人journal独立；基准教材人工/AI来源对照审校透明记账。教学Skill只决定教学行为，不拥有随意修改进度或执行任意系统命令的权限。进度变化由受约束服务提交。

## 2. 未来目录与唯一写入者

以下为计划路径，T01正式创建；不意味着已经存在。每个包独立public接口，跨包导入禁止深入src私有实现。

| 计划路径 | 内容 | 初始owner |
|---|---|---|
| education/package.json, pnpm-lock.yaml, pnpm-workspace.yaml, tsconfig*,配置/脚本 | 独立构建工作区、命令、依赖锁；不接管旧根命令 | T01，后续集成负责人串行变更 |
| education/packages/domain/ | schemas、service ports、fixtures、静态校验类型 | T01；协议变更仍归契约owner |
| education/packages/storage/ | 事件journal、快照、恢复、导出删除 | T02 |
| education/packages/importer/ | PDF/OCR/页图/任务队列/缓存/取消 | T03 |
| education/packages/knowledge/ | 目录、关系、发布、来源查询、覆盖校验 | T04 |
| education/packages/learner/ | 三轴投影、证据rubric、复习计划 | T06 |
| education/packages/tutor/ + education/skills/biology/ | DSH教学工具、教学编排和Skill | T07 |
| education/packages/visuals/ | 受控图示、结构图作答与图片反馈服务 | T11 |
| education/client/shell/ | root布局、认证、导航、首页记录、设计token | T08 |
| education/client/library/ | 教材库、任务进度、PDF来源阅读 | T09 |
| education/client/map/ | 树/局部关系图、筛选与状态 | T10 |
| education/client/study/ | 学习复习互动、活动容器 | T12 |
| education/client/visuals/ | 图示渲染与作答控件 | T11 |
| education/runtime/ | DSH桥接、组合配置、服务注册、host路由 | T01建骨架；T13串行集成；各功能交registration factory给集成方 |
| education/desktop/ | 桌面壳、原生选择文件、安装配置 | T16；T01可留最小启动adapter |
| education/content/biology-7a/ | 自有概念/目标/rubric/活动/覆盖台账，无原文原图 | T05首节；T14串行接续全册 |
| education/tests/integration/,e2e/ | 跨模块测试；测试夹具优先消费domain | T13；T15追加教育验收 |
| education/tests/education/ | rubric、教学行为、全册覆盖与人工判读 | T15 |
| education/probes/runtime/ | T00隔离验证，不能变成正式产品实现 | T00 |
| education/.local/ | 输入PDF、解析缓存、开发数据、日志、live报告（忽略版本控制） | 各任务自己的子目录 |

依赖关系：domain←storage/knowledge/importer/learner/visuals；tutor依赖这些包的port与DSH adapter；client仅依domain公开DTO/API client；runtime负责组合。importer不直接写学习成绩，visuals不直接控制UI路由，learner不运行LLM。服务实现可以互相调用port，不互相import可变内部状态。

T01提供模块发现入口：各包导出registerEducationFeature(ctx,services)或按DSH实际API冻结的等价factory；各UI导出page/component registry；注册顺序由runtime集中一次完成。禁止T02–T12都编辑同一个宿主注册文件。脚本/依赖变更由申请清单交契约/集成owner，未同步前不能宣称包可构建。

## 3. 关键数据流

### 导入

文件选择器→受管本地asset→sha256与metadata确认→ImportJob→本地文本提取/按页OCR→原图/图注定位→候选结构与概念→校验→审核台账→发布content pack→地图查询。已有基准hash可复用；同版重扫描必须重建页码映射。原PDF与裁图不进源码包。

长任务由后台作业管理：并发有界、按页checkpoint、输入hash+parserVersion缓存。文本层优先，扫描页才OCR，图像不被纯文本替代。每次模型抽取按章/节限制上下文和次数；未检查全册不能显示100%。模型中断与本地解析失败可分别重试，不重做已确认人工修订。缓存命中必须验证版本，不能偷用另一本书产物。

### 教学

用户打开concept→加载绑定版本的内容与个人投影（published正式学习；显式试用candidate按公共契约禁用强结论）→创建DSH会话并绑定education session→Skill按mode与证据选活动→模型解释/教育工具获取来源→用户作答先持久化→批改候选→rubric校验→原子提交evidence/progress/review→实时刷新地图。模型失败保留已提交问题并给重试，重试不重复记分。暂停后恢复同一活动，而不是只显示“上次学到第几节”。

### 图示/图片

DiagramSpec经schema/学科语义校验→安全渲染；上传图经asset接入→能力检测→视觉模型/结构化反馈→不确定则澄清→证据审核。用规则题处理点选标注，开放文字/图片的模型反馈带理由、来源和不确定性。绝不执行模型生成代码，也不把图片中的指令当系统命令。

## 4. 账户、权限与数据边界

- 模型平台授权、桌面/Host访问认证、本地Learner三个身份分离。单机产品不要求学生注册应用账号；更换模型账号不重置学习档案。
- 保留正当DSH模型账户授权流程，密钥备选接入保留；派生产品是否可用DSH专用授权由T00核实。不能自行调用未获准端点、伪装官方客户端或索取网页Cookie。若平台不允许，账号能力标为未通过并交用户决定，不能悄悄用API Key冒充已完成账户授权。
- 后端拒绝未授权API/WS，不因客户端隐藏按钮就视为安全。启动只绑定loopback，保留Host/Origin/会话隔离、工具allowlist。默认学生agent不得调用shell/PTC/任意文件读写/插件安装/系统设置。
- 教材读取限制到用户显式导入资产；export写由用户选择的目标；删除教材与删除学习记录是两个操作，有影响说明和确认。所有删除先确认解析后的真实目标，不拼接用户路径进行递归删除。
- 账号token只在host密钥存储；客户端仅有available/status。provider切换不把已有秘密发送到新来源。日志、导出、截图、测试fixture禁止秘密与身份信息。
- 本地优先不承诺全离线：调用前说明必要文本/图片会发到选定模型提供方。默认只发送当前任务最少材料，不发送整个个人journal。离线能读已有材料/地图/记录，云推理不可用时明确降级，不编造回答。
- 正式安装包仅含自有内容结构/练习/图形、代码与许可；教材PDF/原图/OCR全文/课标全文、个人journal、密钥、内部研习文档不随包。打包白名单与泄漏扫描为阻断门。

## 5. T01必须兑现的命令合同

在工作区根执行，目录参数不靠shell cd。下列是未来脚本名，当前旧根命令不代表它们已存在。

| 命令 | 性质与完成定义 |
|---|---|
| pnpm --dir education install --frozen-lockfile | 固定依赖，可重复安装；首次T01生成锁后执行 |
| pnpm --dir education typecheck | 所有新包/UI/host静态检查 |
| pnpm --dir education typecheck:task Txx / test:task Txx | T01提供任务到包与测试路径映射，子任务并行时仅检查自身包及冻结依赖，不读取其他worker半成品 |
| pnpm --dir education test | 离线单元/契约/适配器回归；不得隐式真实调用 |
| pnpm --dir education test:contracts | 公共合法/非法fixtures及端口一致性 |
| pnpm --dir education test:integration | 真实本地服务+隔离临时目录，模型可mock并显式标注 |
| pnpm --dir education test:e2e | 真实教育UI事件路径；可选择mock/live环境，报告标明 |
| pnpm --dir education content:validate | 指定内容包及来源/覆盖引用校验；缺基准数据必须非零或blocked，不能skip后全绿 |
| pnpm --dir education eval:offline | 教育回放与规则/安全回归，不替代live |
| pnpm --dir education eval:live | 显式opt-in、预算/模型/输入/报告路径；不自动读取旧根.env |
| pnpm --dir education build | 全部新产物可构建、无隐式联网教材下载 |
| pnpm --dir education dev | 启动本项目独立本地实例，清楚输出实际URL，不占用当前DSH GUI |
| pnpm --dir education build:win | T16提供便携版与安装版，包含实际DSH运行时 |
| pnpm --dir education smoke:packaged | T16运行实际打包产物，隔离新userData |

T01先实现已到阶段的脚本；后续未实现脚本必须明确非零“not implemented”，不得echo成功。T13/T15/T16依次补齐。scripts-owner表与接口冻结报告包含每条脚本的真正执行入口和参数。旧根pnpm typecheck/test只在碰旧代码时必须复跑，不能代替新产品验收。

## 6. 运行质量及失败约束

基本开发验收规模：自有500概念/1000关系fixture，地图只取局部有界邻域、列表虚拟化或同等方案；普通1440×900与1280×800视口可用。指标是工程试验值而非已实测性能。T10/T13记录测试机器、实测打开/切换延迟，发现无法满足可用性须修复，不编造毫秒保证。不要求全书每个概念每次都调用模型。

取消可见、重试幂等、服务重启恢复、磁盘满未保存、内容缺失、模型鉴权失败/限流、图片不清楚、无视觉模型都各有学生文案和恢复动作。无Key启动能看引导/导入/已有材料，不能白屏；有Key只是状态，不证明真实通路成功。

## 7. 授权与外部前置

用户本轮仅授权文档。后续用户派发任务卡后，授权该卡内可逆实现/测试与清单化新依赖；没有派发不得实施。发布、推送、删除旧工程、外部账号注册、付费订阅仍不是默认动作。真实模型调用预算未给定时默认0；先完成离线验证，live栏写待预算，不能当通过。得到预算后记录provider与单价、最大调用/开销/截止，并在达到上限时停止。不得用重跑碰运气隐藏教学失败。

材料前置：当前工作区未找到原PDF。T03可用自有fixtures开发；T05/T14真实教材引用、页码和全册覆盖必须拿到用户允许使用的真实PDF。优先请用户确认已有文件位置，不扫个人盘、不擅自下载/再分发教材。缺少输入只阻塞其依赖项，其他独立任务可继续。

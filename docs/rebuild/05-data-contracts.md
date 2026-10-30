# 公共数据与服务契约 v1

> 性质：后续 T01 必须实现并冻结的规范，不是已有代码。产品语义来自[产品契约](01-product-contract.md)，执行权责见[对话编排](08-execution.md)。旧领域契约只作迁移输入，不直接扩写。

## 1. 契约冻结规则

T01 在新教育工作区将本规范实现为 TypeScript 类型、运行时校验器、JSON Schema（需要时）及合法/非法 fixtures。所有边界拒绝未知关键字段与无效引用；schemaVersion 显式。T01 提交 contract-lock（版本、文件hash、命令），T02以后只消费，不各自复制类型。变更必须给兼容方案、受影响任务、迁移与测试，集成负责人串行落地；已启动消费者须重新验证。英文符号是接口标识，学生只见中文。

## 2. 标识、时间与来源

- ID 为不透明字符串，不从标题临时生成；教材实例与课程版本分离。conceptId 在同一课程版本内稳定；重命名不改 ID；跨版本需显式映射，禁止猜测自动合并。
- 所有时间 RFC3339 UTC；展示用系统时区，测试注入 clock。排序用服务端 seq，不以客户端时钟决定事实先后。
- 每个实体 schemaVersion:1；引用必须能解析到会话绑定的同一内容版本：正式学习为published包；显式试用可用schema与引用校验通过的candidate/machine_checked包，trustMode=candidate。rejected包不可进入教学。字节文件用 SHA256；内容规范化hash另列，不能拿归一化文本hash冒充原PDF同一文件。

| 实体 | 最低字段与不变量 |
|---|---|
| CourseEdition | id, subject, grade, term, publisher, editionLabel, sourceIdentity, status；首期 subject=biology,grade=7,term=1；identity 从封面/版权页核实，不能只从文件名猜 |
| BookInstance | id,courseEditionId,originalSha256,pageCount,managedAssetId,confirmedMetadata,createdAt；同hash幂等，重新绑定文件不丢个人记录 |
| SourceRef | id,bookInstanceId或baselineSourceId,pdfPage（1基整数）,printedPage（string或null）,bbox（归一化坐标或null）,blockId或figureId,verification；缺印刷页必须明确null，不编造固定偏移 |
| SourceBlock / Figure | id,sourceRefId,type,text或assetId,extractionMethod,textConfidence,reviewState；OCR原稿与修订稿分别保留，原稿不可覆盖 |
| TocNode | id,parentId,type(volume/unit/chapter/section),title,order,sourceRefs；同册目录是一棵树，无环无孤儿；概念用placements关联多个节 |
| Concept | id,courseEditionId,title,aliases,placements[],learningObjectives[],explanation,misconceptions[],sourceRefs[],rubricIds[],activityIds[],reviewState；发布概念必须有来源和可观察目标 |
| Relation | id,fromConceptId,toConceptId,type(prerequisite/related),basis(explicit_source/pedagogical_inference),rationale,sourceRefs[],reviewState；prerequisite A→B 意为建议先理解A再学B，无自环无先修环；related用排序后的端点去重、不要求无环 |
| ContentPack | id,version,courseEditionId,scope(partial/full_volume),coverageStatus(partial/complete),contentHash,toc,concepts,relations,activities,rubrics,coverageManifest,reviewLedger；发布后不可原地改，更新新版本。首节可在声明scope内审核published，但coverageStatus=partial，不能标全册就绪；全册基准需full_volume+complete并通过G2 |
| Learner | id,createdAt；首期单个本地匿名档案，非平台模型账号，无姓名/学校/电话必填 |
| Session | id,learnerId,courseEditionId,packVersion,trustMode(published/candidate),conceptId,mode(learn/review/diagnostic),status(active/completed/abandoned),startedAt,endedAt,resumeCursor,dshSessionId |
| ActivityAttempt | id,sessionId,activityId,activityVersion,conceptIds[],inputType,answerAssetId或answerText,submittedAt,helpUsed[],evidenceIds[]；题目作答与模型建议分开 |
| Evidence | id,attemptId,conceptId,kind(recall/explain/discriminate/transfer/label),observation,criterionResults,assistance,sourceRefs,assessmentOrigin(rule/model/human),modelRunId或null,uncertainty,createdAt；自评独立存储不算客观证据 |
| Assessment | id,conceptId,learnerId,courseEditionId,packVersion,state,rationale,evidenceIds[],rubricVersion,evaluatorVersion,assessedAt,validity；无证据不准产生supported |
| SelfReport | id,learnerId,courseEditionId,packVersion,conceptId,claimedState,createdAt；不能直接写Assessment |
| ConceptProgress | learnerId,courseEditionId,packVersion,conceptId,learning,understanding,review,lastPosition,revision；仅由持久化事件投影产生，UI不可直接写 |

课程共享内容不含学习者记录。SourceRef指向本地教材，发布结构内容不得夹带原图/全文。所有 assetId 都由宿主管理，禁止把任意OS路径当公开接口。

## 3. 三轴状态与派生语义

### 3.1 学习

learning.state = not_started | in_progress | completed；另有startedAt,lastCompletedAt。session.started 令not_started→in_progress；用户完成当前学习单元的可观察活动后记completed，可包含纠错后完成。退出/跳过不能伪造成completed。后续重复学习另建session，保留已完成事实。

### 3.2 理解表现

understanding.state = unassessed | needs_support | developing | supported。UI分别为尚无足够证据、需巩固、初步理解、表现稳定。Assessment是判断，不是认证成绩；必须可回落、可追原因、可显示证据时间。默认不输出0–100掌握百分比。

确定性规则骨架（教学阈值为产品启发式，必须带rubricVersion，非已验证科学定律）：

1. 无有效独立作答→unassessed。只点开/聊天/自评不升级。
2. 最近可解释的独立作答出现核心误概念或不能解释关键区分→needs_support；不因模型单次低可信识图自动降级。
3. 有有效解释或辨析证据，但迁移或跨次一致性不足→developing。
4. supported至少要求同一概念上解释与变式/迁移两类有效独立证据、来自两个已完成活动，其中至少一次未揭示答案且没有未解决的同概念反证；T05/T14逐概念rubric可以更严格，不可更宽泛为“聊过两次”。这是本期可解释显示策略，不能对外称心理测量结论。
5. 新反证可令supported→needs_support/developing；低可信证据标pending不改状态。时间经过本身只标validity=stale并使复习到期，不凭空断言遗忘。已读提示/答案后的作答标assisted，不能充作本轮独立掌握证据。

### 3.3 复习

review = {lastCompletedAt:null|timestamp,dueAt:null|timestamp,activeSessionId:null|string,latestOutcome:null|needs_support|developing|supported,policyVersion}。everReviewed=lastCompletedAt!=null；isDue=dueAt!=null且now>=dueAt。两值并不互斥：昨天复习过仍可今天待复习。活动完成与答对分离。

首版复习策略默认（明确为可调整产品启发式）：学习活动完成后下一日安排首次复习；复习结果needs_support次日、developing三日、supported七日再安排，允许用户提前复习/暂缓一次，均记事件。未开始概念不自动排复习；已学自评仅生成诊断建议，不冒充系统已学。用户时间变化不篡改历史UTC记录；DST与过期队列用注入clock测试。

### 3.4 聚合

按去重conceptId聚合：已学N/可学习总数、待复习数、需巩固数。候选未发布概念单列；同概念多placements不能重复累计。百分比仅可表示活动覆盖率，有明确分母，不能标签为掌握率。

## 4. 教材导入与内容审核

ImportJob = {id,requestId,sha256,stage,status,checkpoint,completedUnits,totalUnits,error,retryable,parserVersion,modelVersion,costUsage,createdAt,updatedAt}。

stage 顺序：accepted→identify→extract→structure→concepts→validate→await_review→ready。status独立为queued/running/paused/failed/cancelled/completed。await_review是待审核，不得伪装全部完成。PDF非法/加密/损坏/缺页必须明确失败；用户确认后再重试，保留已验证产物。按页、阶段、解析器版本缓存。cancel请求之后不发布迟到结果，停止后可恢复或重开。

baseline 精确匹配优先originalSha256；同版不同扫描文件须校验封面版权页/目录/页数及页码映射，由明确匹配结果绑定，不能仅书名相同就装已审图谱。不匹配时生成candidate包，其学习辅助可用但必须醒目标候选、禁用强掌握结论及全册已就绪声明。

reviewState = candidate | machine_checked | curator_checked | published | rejected；curator_checked需actorKind和检查记录；AI执行者可标ai_source_checked但不能冒称人类专家；published要求声明scope内内容验收清单满足；scope=partial的首节发布只解锁G1，full_volume+complete才可进入G2全册验收。无真实原PDF不能完成来源对照审校。是否有人类复核另列，不能用发布状态冒称专家背书。

## 5. 活动、图示与评价载荷

Activity = {id,version,conceptIds,type,stem,sourceRefs,renderSpec?,answerSchema,rubricId,answerDisclosurePolicy}。rubric列关键标准、可接受表达、常见误概念、反例/迁移题及反馈来源。生成题先校验，缺依据的临时题不能升级supported。

DiagramSpec只允许静态受控结构（nodes/edges/labels/regions/altText/sourceRefs），不执行模型生成JS或任意HTML。结构图区域用assetId+归一化坐标，点选/键盘列表有同等作答路径。布局美观与学科正确分开验收。

GradeResult = {attemptId,criteria[],feedback,uncertainties[],evidenceCandidates[],requiresClarification,sourceRefs,graderVersion}。图像不可辨/模型无视觉→明确需要重传或文字描述，不得猜测；不能以OCR字符串命中冒充图形结构理解。模型只提Evidence候选，服务验证来源/活动/assistance后才提交。批改不执行图内指令；页内提示注入与学生恶作剧都是数据。

## 6. 服务接口（T01冻结payload、分页与错误结构）

所有mutations带requestId；宿主绑定learnerId与资产权限，不信任模型/浏览器自行指定他人ID。响应统一 {ok:true,data,revision}|{ok:false,error:{code,message,retryable,detailsRef?}}；内部堆栈/秘密不进入学生message。

| 服务方法 | 输入/输出要点 |
|---|---|
| runtime.capabilities / auth.status | tool集、模型text/image、授权方式可用性；只回状态，不回token |
| library.import / import.status / import.cancel / import.resume | 受管文件handle+确认metadata→job；进度单调且真实，cancel幂等 |
| library.list / library.open / source.resolve | bookId、sourceRefId→摘要/受控页面资源；路径与bbox校验 |
| graph.getToc / graph.getNeighborhood / graph.getConcept | 版本+范围→结构；限制深度和节点量，含三轴投影与seq |
| session.start / session.resume / session.send / session.end | concept+mode→DSH映射；send可流式但不得把未审答案流直接记判定 |
| attempt.submit / assessment.explain | activity载荷→GradeResult/提交后的证据；重复requestId不重复计数 |
| progress.get / progress.selfReport / review.list / review.defer | 来源分离；clock可注入；defer不改为已复习 |
| history.list / history.resume / data.export / data.delete | 本机本人；删除按范围二次确认，删除历史不偷偷改变共享内容 |

实时通知 envelope={schemaVersion,eventId,topic,entityId,revision,seq,payload}，topic至少import.progress/session.output/progress.changed/content.changed/runtime.status。订阅可重连，断线后按seq重新拉快照；UI禁用轮询写状态。

## 7. 持久化与并发

T02以单写者JSONL journal为权威源，快照可重建；DSH会话日志不是教育成绩唯一源。每行是一个完整command commit：{schemaVersion,eventId,requestId,seq,occurredAt,learnerId,type,payload,effects[]}。命令分两段：attempt.submitted先原子持久化原始作答及pending反馈状态，落盘即确认已保存；模型批改成功后assessment.committed将本次Evidence和对应进度/复习effects写入同一journal行，落盘成功才确认反馈已记录。重试只重做同一attempt的批改，不新建作答；assessment提交用attemptId+graderVersion+revision去重。失败/取消独立事件只改pending状态，不判错；禁止等待云反馈才首次保存原答，也不得跨三个文件分写后声称原子。

- 单实例写锁，第二实例可只读或明确拒绝写，不能共同append；requestId持久去重，seq服务端递增。
- 崩溃尾部半行可隔离并报告；中间损坏、schema错误不可静默跳过而继续造新成绩。保留原日志、只读降级与明确恢复步骤。
- checkpoint/snapshot原子替换，验证hash与lastSeq；快照损坏回放journal。写失败UI标未保存，并提供重试，不显示虚假的已记录。
- 目录由宿主userData提供，开发/测试用独立根，不写安装目录、不污染旧S00；managed教材、图片和模型凭据分别存放。
- 导入任务与学习命令串行提交，长模型调用不占全局写锁；迟到响应校验session revision，切换概念后不串写。
- 旧JSONL只读导入，显式备份、逐项迁移receipt；旧mastered不映射为新supported，旧exploring只能为活动痕迹。无用户请求不迁移/删除旧数据。

## 8. 最低契约fixtures

T01提供纯自有文本/图形且不含教材全文：两章、三节、跨节复用概念、A→B与related边；合法正常包；自环/先修环/悬空引用/错误页码/重复ID/错误版本包；三轴组合（已复习且待复习、已学且需巩固、无证据自评）；assisted与unassisted答案；重复requestId、尾半行、中间损坏、失效快照、迟到session响应。T02–T12均消费这些fixtures，不能各造相互不兼容的“样例接口”。
## 9. 内容版本和候选试用的强制规则

Session、ActivityAttempt、Evidence、Assessment、SelfReport、journal业务payload与ConceptProgress均绑定courseEditionId+packVersion；题目还绑定activityVersion/rubricVersion。个人当前投影键为learnerId+courseEditionId+packVersion+conceptId。禁止只用conceptId读取不同包的成绩。T01在上述表未穷举字段处也必须落实这些绑定。

内容更新先生成CompatibilityMap（旧/新包hash、概念/目标/rubric变化、映射理由、review actor）。没有显式验证的映射，只保留旧历史，新包understanding=unassessed；不影响的已学活动可在受审映射下显示历史继承标记，受影响理解证据标stale/needs_recheck，不直接复制supported。旧会话可用旧包只读查看；恢复执行只能绑定原包仍可用，或用户明确开始新版本活动。T06/T13测试改名、拆分、合并、rubric变化和来源修订。

候选试用必须用户显式选择，schema/引用/工具边界校验已过且源材料可访问。记录trustMode=candidate，候选身份贯穿地图/阅读/反馈；允许记录活动、草稿、自评和试用反馈，但正式understanding保持unassessed，不能升级supported、标记基准或计入全册覆盖。候选发布为正式新包后仍需新证据或经审核的兼容映射，绝不因点“确认”转为已审。T07/T09/T12服务端和UI共同落实。

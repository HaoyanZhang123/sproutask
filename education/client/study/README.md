# @edu/client-study

T12 学习/复习学习台：一张摊开的课本 + 练习本，提交后反馈原地展开，学习助手收成右下角「小芽」浮层。

## 现状

- 无 React/Vue；纯 TypeScript DOM，复用 `@edu/client-shell` 的 token/组件/布局、`@edu/client-visuals` 的作答表单/图片流。学习状态文案（学习/理解/复习）直接复用 shell 导出的 `LEARNING_LABELS`/`UNDERSTANDING_LABELS`/`REVIEW_OUTCOME_LABELS`/`SELF_REPORT_LABELS`/`VALIDITY_LABELS`，不再依赖 `@edu/client-map` 的内部模型。
- `/workspace` 页面结构：`.edu-study` → 顶部（概念标题 / 草稿状态 / 结束本轮 / 先不学了）+ 进度条 + `.edu-study-desk`（左页 `study-text-page` 课本、右页 `study-work-page` 题目与原地反馈）+ `ask-sprout-pill` + `sprout-sheet`。窄屏（< 1100px，= shell `breakpoints.compact`）对开消失，课本变成 `study-material-toggle` 抽屉。
- 页面数据与教学回合来自 **fixture**（`src/fixture.ts`），醒目标注“演示样例”。真实 DSH/模型接线归 T13；产物重启归 T16。
- 通过 `shell.registerPage(page)` 接管 `/workspace`，通过 `registerPanel('study:activity'|'study:feedback')` 挂载题目与反馈；`study:visuals` 留给 T11/图示组件。
- 不 import `@edu/tutor`/`@edu/learner`/`@edu/importer` 的实现文件；只消费注入的 `StudyDataSource`（结构上是 T07 `TutorService` 的子集 + T06 学习进度/草稿读取）。

## 用法

```ts
const study = createStudyUi({ dataSource, createRequest, returnPath: '/workspace?mode=learn&concept=concept.cell' });
study.register(shell);
```

T13 实现 `StudyDataSource`：`startSession/submitTurn/skip/end/finishLearning/finishReview/retryPendingGrading` 委托给 `TutorService`；`loadWorkspace/loadProgress/loadReviewRange/deferReview/saveSelfReport` 由 `KnowledgeService` + `LearnerService` 适配；`loadDraft/saveDraft/clearDraft` 接本机持久化；`submitImageAnswer` 接 T11 图片批改。

「下一题」只在 `loadWorkspace` 能按 `activityId` 返回下一道题时前进（fixture 支持）；数据源忽略 `activityId` 时按钮退回「再答一次」，不会假装换题。

## 反馈文案规则（2026-11-04 真机回归后）

- 标题层级只有「结论 chip + 一句结论」；「选择正确。」这类只复述对错的句子不再进入正文。
- 同一句话在整块反馈里只出现一次：结论、依据段、要点、不确定项共用一份已展示清单。
- 模型/评分内部词先翻译：`答案键`→`正确答案`、`criterion*`→`要点`、`option.*`→`这个选项`、`activity.*`/`source.*`→学生话；翻不出来的保留原文，不臆造。
- 出处 chips 按页去重、最多 3 个，只显示能对上已知页码的引用；没有兜底 chip。
- 「改文字再试」只在还需要重答（答错/待澄清）时出现；答对只留「下一题 / 再看看材料」。
- 自评区一句话说明：`选一个，记下来。`（不写“系统证据/单独保存/不替代”这类验收话）。
- 图片判读结论只在原地反馈区出现；图片区只说图片质量与记录状态，避免同一句出现两次。

## 验证

```powershell
cd education/client/study
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/vitest run
```

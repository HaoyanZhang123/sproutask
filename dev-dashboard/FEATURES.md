# 功能地图

## 功能: 和小芽对话：一轮一轮地问，你答完再往下走
- 状态: 可用
- 简介: 选好"今天想做什么"后进入对话，小芽每轮只问一件事、以问句结尾。
- 证据: src/core/agent/session.ts, src/renderer/src/App.vue
- 依赖: 无

### 子项: 开场先问"今天想做什么"，四个入口自己选
- 状态: 可用
- 简介: 预习 / 复习 / 做题 / 拓展，不猜你学到哪了。
- 证据: src/core/agent/session.ts

### 子项: 每轮回复以问句收尾，把问题交回你手上
- 状态: 可用
- 简介: 不替你把话说完，而是让你先开口、先答。
- 证据: src/core/prompts/v2/index.ts

## 功能: 答案不直接给：要也不给，只把你引回课本
- 状态: 可用
- 简介: 直接索要答案、说"明天考试"、撒娇施压，都不会把结论说出来。
- 证据: src/core/agent/guard.ts, evals/cases/socratic.yaml, evals/cases/edge.yaml
- 依赖: 和小芽对话：一轮一轮地问，你答完再往下走

## 功能: 教材窗：这一节要掌握什么、在课本第几页
- 状态: 可用
- 简介: 右侧一栏显示知识点、课标要求与页码出处，边聊边对照。
- 证据: src/renderer/src/components/ReadingPane.vue, content/units/u-cell-basic-unit/knowledge-points.yaml, content/units/u-cell-basic-unit/curriculum.yaml

### 子项: 折叠答案：先自己想想，再点开对照
- 状态: 可用
- 简介: 答案默认收起，想好了再展开。
- 证据: src/shared/section-blocks.ts

### 子项: 在课本里找找看：搜到折叠内容只提示、不自动翻开
- 状态: 可用
- 简介: 搜到答案会先问你要不要看，而不是替你翻开。
- 证据: src/renderer/src/components/ReadingPane.vue

### 子项: 本机没有课本正文时，明说"请对照课本第 X 页"
- 状态: 可用
- 简介: 不拿占位文字冒充课本，也不让小芽编课本原话。
- 证据: src/core/prompts/v2/l2-textbook.ts, src/main/content/runtime.ts

## 功能: 学习记录只留在这台电脑，关掉再打开接着上次
- 状态: 可用
- 简介: 每次打开的对话各自留一份；只用学生编号，不记姓名。
- 证据: src/main/storage/jsonl-store.ts, src/main/ipc/index.ts

### 子项: 开场记得你上次学到哪一节
- 状态: 可用
- 简介: 再打开时会说"上次你在：第四节 细胞的生活"。
- 证据: src/main/ipc/index.ts

## 功能: 第一次打开就能自己配好
- 状态: 可用
- 简介: 引导填写模型钥匙，填错有中文提示；界面上不显示钥匙内容。
- 证据: src/renderer/src/components/ConfigPanel.vue

## 功能: 装到自己电脑上就能用（便携版 / 安装版）
- 状态: 可用
- 简介: 便携版双击即用；安装版装到当前账户、不需要管理员、可卸载。
- 证据: electron-builder.yml, docs/releases/v0.2.0-alpha.md

### 子项: 有自己的图标与署名
- 状态: 可用
- 简介: 文件和安装包里显示芽问自己的图标与作者信息。
- 证据: build/icon.ico

## 功能: 教材内容覆盖：从一节扩到一册
- 状态: 进行中
- 简介: 把课本内容做成"知识点 + 课标要求 + 页码出处"，目前只完成一节。
- 证据: tools/extract_textbook.py, scripts/content-validate.ts

### 子项: 第一单元第二章第四节「细胞的生活」
- 状态: 可用
- 简介: 5 个知识点 + 5 条课标要求，都带印刷页出处。
- 证据: content/units/u-cell-basic-unit/unit.yaml, content/units/u-cell-basic-unit/curriculum.yaml

### 子项: 七年级上册其余章节
- 状态: 设想
- 简介: 按同一套做法逐节入库（提取 → 校错 → 知识点 → 课标 → 校验）。

## 功能: 改话术前后能自动比对，看有没有变差
- 状态: 可用
- 简介: 25 条真实用例跑一遍，专门盯"有没有漏答案、语气像不像老师"。
- 证据: scripts/eval.ts, evals/cases/socratic.yaml

## 功能: 给负责人自己的上手检查单
- 状态: 可用
- 简介: 一页清单，照着用鼠标走一遍，看哪里跟预期不一样。
- 证据: docs/tutorials/真人验收清单.md

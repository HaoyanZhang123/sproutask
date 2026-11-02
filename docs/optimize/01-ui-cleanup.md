# 学生界面清理（批次 1 + 部分批次 2）— 实施记录

- 日期：2026-11-02
- 范围：`education/client/{shell,study,library,map,visuals}`、`education/runtime/client-plugin/src/live-sources.ts`
- 未改：领域契约、依赖、内容包、host 路由、打包流程；**未发起任何真实模型调用**
- 基线：`typecheck` exit 0；`test` 全部包 exit 0（改动后复跑，见下）

---

## 1. 这轮改了什么（逐条对得上候选清单）

| ID | 改动 | 落点 |
|---|---|---|
| A1 | 去掉每页正文里重复的上下文条，只保留页头一条；各页 `renderContextBar` 调用与 import 移除 | `shell/src/pages/{home,placeholders,records,account,first-run,workspace}.ts` |
| A2 | 页面导语改成学生话术（工作区/教材库/地图/记录/账户） | `study/src/page.ts`、`shell/src/pages/*`、`map/src/page.ts` |
| A3 | 侧栏增加「首页」（现在 首页/教材库/地图/工作区/记录） | `shell/src/shell.ts` `NAV_ITEMS` |
| A4 | 账户页与首页不再展示项目决策文本（「用户已明确该路线不允许」等） | `shell/src/pages/{account,home}.ts` |
| A5 | 页脚两条政策说明并成一句；权限说明只留在账户页 | `shell/src/shell.ts` |
| A6 | 技术/英文标签清理：教材标签改为「7年级上册 · 生物」（完整书名与版次核实说明只留在教材库）；首页卡片去掉内容包版本与 `activity.*`/`step-*` 原始 id；账户页不再显示 `learner.local.default`；教材库去掉「文件指纹」行 | `shell/src/labels.ts`、`shell/src/pages/home.ts`、`shell/src/pages/account.ts`、`library/src/components.ts` |
| B1 | 活动题干只显示一次（表单不再重复 stem，改为 `aria-label`） | `visuals/src/answer-forms.ts` |
| B2 | 补回答表单样式：选项改为整行卡片、单选按钮对齐、选中高亮、提交/取消按钮进入设计系统 | `study/src/styles.ts`、`visuals/src/answer-forms.ts` |
| B3 | 页面标题不再显示橙色焦点框（保留 `tabindex=-1` 的无障碍焦点） | `shell/src/styles.ts` |
| B5 | 主次按钮纠正：「提交作答」为主按钮，「结束本轮」降为普通按钮 | `visuals/src/answer-forms.ts`、`study/src/controller.ts` |
| C2 | 地图详情的目录归属显示教材标题而不是 `toc.*` id（沿 `parentId` 组装路径） | `runtime/client-plugin/src/live-sources.ts` |
| C4 | 出处去重并按学生语言命名：5 条 `source block · PDF page N` → 3 条「课本第 2/3/5 页」 | `study/src/controller.ts` |
| 新增 | 材料栏底部重复的三轴徽章移除（右侧栏已有完整三轴） | `study/src/controller.ts` |
| 新增 | 学习助手输入框下的说明书式提示改为一句人话 | `study/src/controller.ts` |
| 新增 | 活动类型显示「选择题」，不再显示「选择 · 版本 1」 | `study/src/labels.ts` `ACTIVITY_TYPE_LABELS` |

## 2. 验证（实测）

1. `pnpm --dir education typecheck` → **exit 0**（全部包）。
2. `pnpm --dir education test` → **全部包 exit 0**。同步更新了 4 条断言（不删断言凑绿）：
   - `shell/test/navigation.test.ts`：导航项从 4 个改为 5 个（含首页）；
   - `shell/test/account.test.ts`：账户页文案断言改为「当前版本不需要平台账号」；
   - `shell/test/home-resume.test.ts`：首页卡片改为断言「不出现原始 activity/step id」，恢复行为仍由后续断言验证；
   - `library/test/library-states.test.ts`：「文件指纹」改为断言「内容范围」。
3. 真实浏览器走查（headless Chrome CDP，1366×900 @DPR2，**未触发模型回合**）：
   - 首页/教材库/地图/工作区/记录/账户 + 一张「地图选中概念」+ 一张「学习中的工作区」；
   - `console` 错误/未捕获异常 **0 条**；
   - 前后对比图：`education/.local/evidence/optimize-2026-11-02/screens/`（改前）与 `screens-final/`（改后）。

## 3. 复现方式

```powershell
pnpm --config.verify-deps-before-run=false --dir education dev     # 起本地教育应用（随机端口）
node education/.local/tools/tour.mjs --meta education/.local/cache/T01/dev-run/web-meta.json --out <dir>   # 逐页截图
node education/.local/tools/flow.mjs --meta education/.local/cache/T01/dev-run/web-meta.json --out <dir>   # 地图→开始学习
```

> 说明：SPA 路由在内存里（`shell.navigate` 不写 URL），所以直接访问 `/workspace` 会 404；`tour.mjs` 用点击导航复现真实路径。

## 4. 仍未做（下一批）

| ID | 事项 | 原因 |
|---|---|---|
| C1 | 地图「出处与材料」永远为空 | **服务端** `/edu/api/g1/map` 返回的 `sources` 数组本身就是 0 条（已实测），不是客户端过滤问题；需要改 `g1-service` 的 map 载荷 |
| B4 | 学习助手 5 个按钮一上来全展示 | 需要重新设计帮助入口（先给 1 个「我需要帮助」，再展开） |
| B6 | 教材库整页是 source 列表 | 需要重排：先书目，再按需展开出处；工作量最大 |
| A7 | 地图关系理由仍是学术长句 | 需要把「教学推断/教材原文」解释压成一句人话 |
| — | 页头仍有「内容包 版本 2.0.0」 | 建议收进「详情」抽屉，需先定交互 |
| C3 | 子页面直接刷新 404 | 当前产品不暴露 URL；若上历史路由需 host 加 SPA fallback |
| A4 余量 | 账户页仍有两条权限/Key 说明 | 属评审口径文本，建议移到「关于」页 |

## 5. 边界

- 未改 `packages/domain` 契约、未加依赖、未新建顶层目录、未动内容包。
- 未打包、未发布、未提交 Git。
- 真实模型调用：**0 次**（本轮只做界面与本地数据路径）。

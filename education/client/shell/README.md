# @edu/client-shell

T08 的教育界面壳：框架无关的 TypeScript DOM（无 React/Vue），运行时依赖 0。

## 当前状态（必须如实阅读）

- 页面数据来自 **T01 冻结 DTO fixture**（`packages/domain/fixtures/**`），界面顶部有“演示数据（fixture）”标识。**不是真实 API 结果**。真实接线由 T13 完成。
- `dsh.client` 元数据与 `src/client-entry.ts` 的 root 注册接缝已提供；loader 协议 bundle 与 React root 桥接**尚未构建**，归 T13/T16。`src/client-entry.ts` 中 `EducationRootHost.createRootOccupant` 是唯一需要宿主适配的接口。
- 本包不包含终端、代码、插件市场或通用开发设置入口；权限由后端裁剪，客户端只显示后端返回的 `auth.status` 可用性，不持有 token。

## 页面与挂载契约

页面形状对齐 `education/runtime/src/pages.ts` 的 `PageDefinition`：

```ts
interface EducationPage {
  id: string;
  path: string;
  title: string;
  requiresLearner: boolean;
  mount(context: EducationPageContext): void | Promise<void>;
  unmount(): void | Promise<void>;
}
```

`EducationPageContext` 提供真实 `container: HTMLElement`、`services` 与 `navigate`。
通过 `shell.registerPage(page)` 注册；T09/T10/T12 可覆盖同路径的内置 fallback 页面。
T11 的图示/反馈面板通过 `shell.registerPanel('study:visuals', panel)` 挂到工作区命名槽位：

- `library:content`、`library:import`
- `map:content`、`map:details`
- `study:activity`、`study:feedback`、`study:visuals`

公共组件（空态/错误条/保存失败/确认对话框/证据卡/状态标签）从包入口单独导出，其他 client 包可直接复用；shell 本体归 T08，其他任务不要直接改。

## 设计约束

- token 集中在 `src/tokens.ts`：20px 基准（1.25rem），字号/间距用 rem；状态同时有颜色和文字标签。
- 键盘：所有动作是原生 `<button>`；Tab 顺序与阅读顺序一致；对话框有焦点陷阱、Escape 关闭、关闭后焦点回触发处。
- 布局断点：≥1100px 侧栏 + 内容；窄窗单列。`evaluateLayout()` 提供逻辑布局预算，测试在 1280×800 与 1440×900 断言不横向溢出（不是像素美化验收）。
- 记录页三轴分开（学习进程/理解证据/复习活动）+ 自评单独标注；不显示 0–100 掌握百分比。
- 账户状态：平台账户与 API Key 分行显示；账户路线在本产品线不可用，API Key 只显示“已配置/未配置”。

## 验证

```powershell
pnpm --dir education typecheck:task T08
pnpm --dir education test:task T08
```

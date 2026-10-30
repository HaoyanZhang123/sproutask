# @edu/client-map (T10)

教材树 + 局部概念地图的框架无关 DOM 界面。挂在 T08 `@edu/client-shell` 的 `/map` 页与 `map:content` / `map:details` 两个槽位上。

```ts
const map = createMapUi({ dataSource: createFixtureMapDataSource({ scenario: 'demo' }) });
map.register(shell); // 替换 shell 的 /map fallback
```

## 结构

| 文件 | 作用 |
|---|---|
| `src/types.ts` | `MapDataSource` 读模型接缝、有界 `GraphSlice`、概念详情/搜索形状 |
| `src/fixture.ts` | 明确标注“演示数据（fixture）”的合成数据源（demo / candidate / scale 三种场景） |
| `src/model.ts` | 目录树行、去重计数、三轴标签、聚合分母、确定性图布局 |
| `src/views.ts` | 树/图/关系表/概念列表/详情/搜索的纯渲染函数 |
| `src/controller.ts` | 页面状态、键盘目录导航、有界加载、跨章展开、搜索/筛选 |
| `src/page.ts` | `/map` 页与两个槽位容器 |
| `src/styles.ts` | 仅使用 `@edu/client-shell` 设计 token 的样式（rem、focus-visible、无横向溢出） |

## 给 T13 的接线

`MapDataSource` 是唯一接缝，实现五个只读方法即可；T10 不写学习状态：

```ts
export interface MapDataSource {
  readonly kind: 'fixture' | 'live';
  readonly notice: string | null;
  loadMap(request): Promise<DataResult<MapPayload>>;
  loadChapterGraph(request, tocNodeId, { maxNodes, maxDepth, visibleConceptCount }): Promise<DataResult<GraphSlice>>;
  expandConcept(request, conceptId, { maxNodes, maxDepth }): Promise<DataResult<GraphSlice>>;
  searchConcepts(request, query, limit): Promise<DataResult<readonly ConceptSearchHit[]>>;
  loadConceptDetail(request, conceptId): Promise<DataResult<ConceptDetail>>;
}
```

真实 facade 对应关系：

- `loadMap` ← `KnowledgeService.getToc` + `getPackSummary` + `getConcept`（包内全部概念）+ 学习者投影 `LearnerProjectionStore.list` + 自评/证据读取；`fixture: false`、`notice: null`。
- `loadChapterGraph` ← 章内概念集合 + `KnowledgeService.getNeighborhood`（`maxNodes/maxDepth` 直接透传，`truncated` 决定“展开更多”按钮）。
- `expandConcept` ← `KnowledgeService.getNeighborhood`（跨章显式展开，硬上限 25 节点 / 2 层）。
- `searchConcepts` ← `KnowledgeService.searchConcepts`（标题/别名）。
- `loadConceptDetail` ← `getConcept` + `resolveSourceRef`（出处摘要，只有页码/印刷页/材料可用性，无 OS 路径）+ 证据/自评只读列表。

`fixture: true` 时页面显示“演示数据（fixture）”徽标；接真实数据源后必须为 `false` 且 `notice` 置空，不能把示例内容当真实教材。

## 边界

- 不实现存储、不写 journal、不改变学习进程；“开始学习/开始复习”只做路由跳转（T12 负责活动）。
- 候选内容：理解状态固定显示“尚无足够证据（候选内容禁用强结论）”，候选概念单列、不进入正式分母。
- 无掌握百分比；聚合只给“已学 N / 可学习 M（去重概念）”。
- 图节点上限 24（初始）/ 96（显式展开后），跨章邻域 25 节点 / 2 层；默认从不铺满全册。

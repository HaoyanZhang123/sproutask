# 提示词层

> 当前使用 `v1/`；版本化的意义见下。

按 docs/ARCHITECTURE.md「Agent 运行时设计」落地分层：

```
src/core/prompts/
└─ v1/
   ├─ index.ts        # 汇总各层，导出 PROMPT_VERSION 与 buildMessages()
   ├─ l0-persona.ts   # 身份、语气、150 字上限
   ├─ l1-discipline.ts# 苏格拉底规则、防抄作业、超纲处理、安全红线
   ├─ l2-textbook.ts  # 教材上下文拼装（单元概览 + 当前小节全文）
   ├─ l3-profile.ts   # 学情摘要（掌握度、重复出现的误区）
   └─ l4-session.ts   # 会话上下文（引导模式下的目标知识点、已用提示次数）
```

## 约定

- 每层一个文件、导出一个字符串常量或拼装函数；**禁止在业务代码里内联提示词**；
- 版本化：改动教学规则 = 新建 `v2/`，保留 `v1/`，便于对比教学效果（A/B）；
- 提示词文本是"教学内容"而非代码，允许用中文并写清教学意图注释；
- 每个版本附 `evals/cases/` 用例，改动前后必须跑 `pnpm eval` 对比。

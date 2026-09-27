"""
教材文本修正工具（开发期，人工核对的一环）

为什么单独做一步（而不是在提取时顺手改）：
    OCR 产物是"来源证据"，**不许无声改写**。所以修正走"显式修正表 + 修正日志"：
    每一处改动都写清 before/after/理由，人工可以拿着日志逐条复核（见 docs/adr/ADR-0007 与用户要求）。

用法（路径都放 JSON，避免 Windows 下中文路径当命令行参数被编码搞坏）：
    python tools/fix_textbook_text.py --config D:\\path\\fix-section-4.json

配置文件：
{
  "in":         "content/textbook/.../第四节-细胞的生活.md",
  "out":        "content/textbook/.../第四节-细胞的生活.reviewed.md",
  "changelog":  "content/textbook/.../第四节-细胞的生活.修正日志.md",
  "auto":   [ {"find": "纟田胞膜", "replace": "细胞膜", "reason": "OCR 把'细'拆成'纟田'"} ],
  "review": [ {"text": "细胞的生活是物质、能量和信息的统", "issue": "疑似漏字", "suggestion": "统一"} ]
}

退出码：有任何一条 auto 规则**没命中**就返回 1（说明修正表过期或文本已变，不能装作改好了）。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def apply_corrections(text: str, rules: list[dict]) -> tuple[str, list[dict], list[dict]]:
    """返回 (修正后文本, 命中记录, 未命中记录)"""
    hits: list[dict] = []
    misses: list[dict] = []
    for rule in rules:
        find, replace = rule['find'], rule['replace']
        count = text.count(find)
        if count == 0:
            misses.append(rule)
            continue
        text = text.replace(find, replace)
        hits.append({**rule, 'count': count})
    return text, hits, misses


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', required=True)
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text(encoding='utf-8'))
    src = Path(cfg['in'])
    out = Path(cfg['out'])
    log = Path(cfg['changelog'])

    original = src.read_text(encoding='utf-8')
    fixed, hits, misses = apply_corrections(original, cfg.get('auto', []))

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(fixed, encoding='utf-8')

    lines = [
        '# 教材文本修正日志（OCR 后人工核对用）',
        '',
        f'- 来源：`{src.as_posix()}`',
        f'- 产物：`{out.as_posix()}`',
        f'- 自动修正：**{len(hits)} 条规则命中**（共 {sum(h["count"] for h in hits)} 处）',
        f'- 未命中规则：{len(misses)} 条（说明修正表过期或文本已变，需要人看）',
        f'- 待人工确认：{len(cfg.get("review", []))} 处（**未自动改动**）',
        '',
        '> 规则：**原始提取产物保持不动**；本文件记录的是"我们改了什么、为什么"。',
        '> 复核方式：对着课本原图，逐条看下面的 before → after 是否成立。',
        '',
        '## 一、已自动修正（逐条可复核）',
        '',
    ]
    if hits:
        for h in hits:
            lines += [
                f'- `{h["find"]}` → `{h["replace"]}`（{h["count"]} 处）',
                f'  - 理由：{h.get("reason", "（未写理由）")}',
            ]
    else:
        lines.append('（无）')

    lines += ['', '## 二、规则未命中（需要人看）', '']
    lines += [f'- `{m["find"]}` → `{m["replace"]}`：文本里没找到，可能已修或原文不同'
              for m in misses] or ['（无）']

    lines += ['', '## 三、待人工确认（未自动改动）', '']
    review = cfg.get('review', [])
    if review:
        for r in review:
            lines += [
                f'- 原文片段：`{r["text"]}`',
                f'  - 问题：{r["issue"]}',
                f'  - 建议：{r["suggestion"]}',
            ]
    else:
        lines.append('（无）')

    log.write_text('\n'.join(lines) + '\n', encoding='utf-8')

    print(f'✅ 已写出修正稿：{out}')
    print(f'📝 修正日志：{log}')
    print(f'   自动修正 {len(hits)} 条规则 / {sum(h["count"] for h in hits)} 处；'
          f'未命中 {len(misses)} 条；待人工确认 {len(review)} 处')
    if misses:
        for m in misses:
            print(f'   ⚠️ 未命中：{m["find"]}')
        sys.exit(1)


if __name__ == '__main__':
    main()

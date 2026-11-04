"""
Markdown → Word（.docx）转换器（开发期工具，不进 exe）

用途：把 `docs/研习材料/*.md` 转成可直接打印的问卷/同意书 Word 文件。
支持本仓库问卷用到的最小子集：标题、段落、加粗、无序列表、引用、分隔线、表格、复选框字符。

用法：
    python tools/md_to_docx.py docs/研习材料/F-014-前测问卷.md 输出.docx \
        --stop-at "## ⚙️ 教师用页"          # 只导出学生用部分（在标记处截断）
    python tools/md_to_docx.py a.md b.md --append 输出.docx   # 多文件合并（教师用说明）

依赖：python-docx（`python -m pip install python-docx`）
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Pt, Cm

BODY_FONT = "宋体"
HEADING_FONT = "黑体"
BODY_SIZE = Pt(11)
CHECKBOX = "\u2610"  # □ 保持原样


def set_cjk_font(run, name: str) -> None:
    """python-docx 需同时设置西文与东亚字体，中文才不会回退成默认字体。"""
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)


def add_runs(paragraph, text: str) -> None:
    """处理 **加粗** 行内标记"""
    for index, piece in enumerate(re.split(r"\*\*(.+?)\*\*", text)):
        if not piece:
            continue
        run = paragraph.add_run(piece)
        run.bold = index % 2 == 1
        run.font.size = BODY_SIZE
        set_cjk_font(run, BODY_FONT)


def add_table(doc: Document, rows: list[list[str]]) -> None:
    """把 markdown 表格转成 Word 表格（首行作表头加粗）"""
    if not rows:
        return
    width = max(len(r) for r in rows)
    table = doc.add_table(rows=0, cols=width)
    table.style = "Table Grid"
    for row_index, cells in enumerate(rows):
        row = table.add_row().cells
        for col in range(width):
            text = cells[col] if col < len(cells) else ""
            paragraph = row[col].paragraphs[0]
            add_runs(paragraph, text)
            if row_index == 0:
                for run in paragraph.runs:
                    run.bold = True
    doc.add_paragraph()


def convert(md_text: str, doc: Document) -> None:
    lines = md_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # 表格：连续以 | 开头的行
        if stripped.startswith("|"):
            rows: list[list[str]] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            add_table(doc, rows)
            continue

        if not stripped:
            i += 1
            continue

        # 分隔线：跳过（Word 里不需要）
        if re.fullmatch(r"-{3,}", stripped):
            i += 1
            continue

        heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading:
            level = len(heading.group(1))
            paragraph = doc.add_paragraph()
            paragraph.paragraph_format.space_before = Pt(10)
            paragraph.paragraph_format.space_after = Pt(6)
            if level == 1:
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = paragraph.add_run(heading.group(2))
            run.bold = True
            run.font.size = Pt(18 if level == 1 else 15 if level == 2 else 12.5)
            set_cjk_font(run, HEADING_FONT)
            i += 1
            continue

        if stripped.startswith(">"):
            paragraph = doc.add_paragraph()
            paragraph.paragraph_format.left_indent = Cm(0.75)
            run = paragraph.add_run(stripped.lstrip("> ").strip())
            run.italic = True
            run.font.size = Pt(10)
            set_cjk_font(run, BODY_FONT)
            i += 1
            continue

        bullet = re.match(r"^[-*]\s+(.*)$", stripped)
        if bullet:
            paragraph = doc.add_paragraph(style="List Bullet")
            add_runs(paragraph, bullet.group(1))
            i += 1
            continue

        numbered = re.match(r"^(\d+)[.、]\s+(.*)$", stripped)
        if numbered:
            paragraph = doc.add_paragraph()
            paragraph.paragraph_format.left_indent = Cm(0.5)
            add_runs(paragraph, f"{numbered.group(1)}. {numbered.group(2)}")
            i += 1
            continue

        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(4)
        add_runs(paragraph, stripped)
        i += 1


def load_markdown(path: Path, stop_at: str | None) -> str:
    text = path.read_text(encoding="utf-8")
    if stop_at:
        index = text.find(stop_at)
        if index == -1:
            print(f"⚠️  {path.name}: 未找到截断标记 {stop_at!r}，将导出全文", file=sys.stderr)
        else:
            text = text[:index]
    return text


def new_document() -> Document:
    """新建文档并设置页边距（略收，便于一页容纳更多题目）"""
    doc = Document()
    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.2)
        section.right_margin = Cm(2.2)
    return doc


def main() -> int:
    parser = argparse.ArgumentParser(description="Markdown → Word 转换（研习材料用）")
    parser.add_argument("inputs", nargs="+", help="输入的 .md 文件（可多个）")
    parser.add_argument("--output", "-o", required=True, help="输出的 .docx 路径")
    parser.add_argument("--append", action="store_true", help="多个输入合并到同一个文档")
    parser.add_argument("--stop-at", default=None, help="遇到该标记即截断（只导出学生用部分）")
    args = parser.parse_args()

    inputs = [Path(p) for p in args.inputs]
    for path in inputs:
        if not path.exists():
            print(f"❌ 找不到输入文件：{path}", file=sys.stderr)
            return 1

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    if args.append:
        # 合并模式：所有输入写进同一个文档（注意不能与 targets 一起 zip，否则只会转第一个）
        doc = new_document()
        for path in inputs:
            convert(load_markdown(path, args.stop_at), doc)
            print(f"✅ {path.name} → {output.name}（合并）")
        doc.save(output)
        return 0

    if len(inputs) == 1:
        targets = [output]
    else:
        # 多文件不合并：各自输出到 -o 所在目录，文件名取输入的文件名
        targets = [output.parent / f"{path.stem}.docx" for path in inputs]

    for path, target in zip(inputs, targets):
        doc = new_document()
        convert(load_markdown(path, args.stop_at), doc)
        doc.save(target)
        print(f"✅ {path.name} → {target}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

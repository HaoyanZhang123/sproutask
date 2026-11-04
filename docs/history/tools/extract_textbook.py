"""
教材 PDF → 按小节切分的 Markdown（开发期工具，不进 exe）

背景：本项目拿到的教材 PDF 是**扫描版（无文字层）**，所以流程是
    渲染（PyMuPDF）→ OCR（Windows 内置 zh-Hans-CN，见 tools/ocr_winrt.ps1）→ 清洗分段 → Markdown

合规（务必遵守，见 docs/adr/ADR-0007）：
    产物写进 `content/textbook/`（已在 .gitignore）——**教材原文只在本机、不随包、不进公开仓库**。
    本工具不修改仓库里受版本控制的任何文件。

用法：
    python tools/extract_textbook.py --pdf "<教材.pdf>" --pages 37-41 \
        --volume "人教版 七年级上册" --unit "第一单元 生物和细胞" \
        --chapter "第二章 认识细胞" --section "第四节 细胞的生活" \
        --out "content/textbook/rjb-7s/第一单元/第二章/第四节-细胞的生活.md"

    python tools/extract_textbook.py --selftest      # 只跑清洗函数的自检

依赖（本机已有，不需新增）：PyMuPDF（`import fitz`）、以及 Windows 自带的 OCR。
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

CJK = r'\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff'
CJK_PUNCT = r'\u3000-\u303f\uff00-\uffef'

# 页脚里那行版权声明（每页都有）——出现即视为页脚
COPYRIGHT_MARKERS = ('供个人学习使用', '未经授权', '版权所有', '仅供个人')

# 页脚/页眉里那种"导航"行：只含 单元 / 章 的短行（例：'第二章认识细胞'、'第一单元生物和细胞'）。
# 注意**不能**把含"节"的行算进来——真正的章节标题长这样：'第四节细胞的生活'，必须保留。
RUNNING_HEAD = re.compile(rf'^第?[{CJK}0-9]{{0,12}}(单元|章)[{CJK}]{{0,12}}$')

# 单独成行的纯数字（1–3 位）＝页码残留，不是正文
PAGE_NUMBER_ONLY = re.compile(r'^\d{1,3}$')

# 正文里的结构标记：遇到就另起一段
BLOCK_STARTS = (
    '想一想', '议一议', '讨论', '练习与应用', '拓展应用', '概念检测',
    '科学·技术·社会', '科学方法', '小资料', '项目链接', '古话今议', '想象空间',
    '通过本节学习', '实验目的', '材料用具', '方法步骤', '注意事项', '进一步探究',
)


def despace(text: str) -> str:
    """去掉汉字之间、汉字与中文标点之间的多余空格（OCR 会把每个字分开）。"""
    prev = None
    while prev != text:
        prev = text
        text = re.sub(rf'(?<=[{CJK}])\s+(?=[{CJK}])', '', text)
        text = re.sub(rf'(?<=[{CJK}])\s+(?=[{CJK_PUNCT}])', '', text)
        text = re.sub(rf'(?<=[{CJK_PUNCT}])\s+(?=[{CJK}])', '', text)
    return text


def split_footer(line: str) -> tuple[str, int | None]:
    """把页脚行拆成 (去掉版权声明后的剩余文本, 印刷页码或 None)。"""
    page = None
    m = re.search(r'(\d{1,3})\s*$', line)
    if m:
        page = int(m.group(1))
    # 取所有标记里最靠前的那个位置（'仅供个人学习使用'与'供个人学习使用'会命中同处，取更靠前的）
    cut = min((line.find(marker) for marker in COPYRIGHT_MARKERS if marker in line), default=-1)
    head = line[:cut] if cut >= 0 else line
    return head.strip(), page


def is_running_head(text: str) -> bool:
    compact = re.sub(r'\s+', '', text)
    return bool(RUNNING_HEAD.match(compact))


def join_paragraphs(lines: list[str]) -> list[str]:
    """把 OCR 的物理行合并成段落：句末标点处断开，结构标记前断开。"""
    paras: list[str] = []
    buf = ''
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        starts_block = any(line.startswith(mark) for mark in BLOCK_STARTS)
        if buf and (starts_block or buf.endswith(('。', '！', '？', '；'))):
            paras.append(buf)
            buf = ''
        if starts_block and buf == '':
            paras.append(line)
            continue
        buf = (buf + line) if buf else line
    if buf:
        paras.append(buf)
    return paras


def parse_ocr_output(text: str) -> list[tuple[str, list[str]]]:
    """把 OCR 输出切成 [(页文件名, [行...]), ...]"""
    pages: list[tuple[str, list[str]]] = []
    name: str | None = None
    buf: list[str] = []
    for raw in text.splitlines():
        # BOM / 零宽字符清理：PowerShell 写出的文件可能带 BOM，会让第一页标记行匹配不上
        line = raw.lstrip('\ufeff\u200b')
        m = re.match(r'^=====\s*(.+?)\s*=====$', line)
        if m:
            if name is not None:
                pages.append((name, buf))
            name, buf = m.group(1), []
        elif name is not None:
            buf.append(line)
    if name is not None:
        pages.append((name, buf))
    return pages


def clean_page(lines: list[str]) -> tuple[list[str], int | None]:
    """清洗一页：去空格 → 剔除页脚/页眉 → 合并段落。返回 (段落列表, 印刷页码)"""
    printed: int | None = None
    kept: list[str] = []
    for raw in lines:
        line = despace(raw).strip()
        if not line:
            continue
        if any(marker in line for marker in COPYRIGHT_MARKERS):
            head, page = split_footer(line)
            printed = printed or page
            if head and not is_running_head(head):
                kept.append(head)
            continue
        if is_running_head(line) or PAGE_NUMBER_ONLY.match(line):
            # 单独成行的数字＝印刷页码：记下来（出处要用），但不作为正文
            if PAGE_NUMBER_ONLY.match(line) and printed is None:
                printed = int(line)
            continue
        kept.append(line)
    return join_paragraphs(kept), printed


def run_ocr(pngs: list[Path], helper: Path, out_txt: Path) -> None:
    cmd = [
        'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', str(helper), '-Out', str(out_txt), *[str(p) for p in pngs],
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if proc.returncode != 0:
        raise RuntimeError(f'OCR 失败（exit {proc.returncode}）：{(proc.stderr or proc.stdout)[-500:]}')


def parse_pages(spec: str) -> list[int]:
    pages: list[int] = []
    for part in spec.split(','):
        part = part.strip()
        if '-' in part:
            a, b = part.split('-', 1)
            pages.extend(range(int(a), int(b) + 1))
        elif part:
            pages.append(int(part))
    return pages


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', help='JSON 配置文件（推荐：Windows 下中文路径作为命令行参数可能被编码搞坏）')
    ap.add_argument('--pdf')
    ap.add_argument('--pages', default='', help='如 37-41 或 37,38,40')
    ap.add_argument('--out')
    ap.add_argument('--dpi', type=int, default=200)
    ap.add_argument('--volume', default='')
    ap.add_argument('--unit', default='')
    ap.add_argument('--chapter', default='')
    ap.add_argument('--section', default='')
    ap.add_argument('--printed-pages', default='', help='人工核定的印刷页范围（如 28-32）；给了就用它，否则用 OCR 认出来的')
    ap.add_argument('--keep-temp', action='store_true', help='保留渲染出的 PNG（排查 OCR 质量用）')
    ap.add_argument('--selftest', action='store_true', help='只跑清洗函数自检')
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    # 配置文件里放 pdf/pages/out 与元信息；命令行参数优先（便于临时覆盖）
    if args.config:
        import json
        cfg = json.loads(Path(args.config).read_text(encoding='utf-8'))
        for key in ('pdf', 'pages', 'out', 'volume', 'unit', 'chapter', 'section', 'printed_pages'):
            if not getattr(args, key.replace('-', '_')):
                setattr(args, key.replace('-', '_'), cfg.get(key, ''))

    if not (args.pdf and args.pages and args.out):
        ap.error('需要 --pdf / --pages / --out（或用 --config / --selftest）')

    import fitz  # PyMuPDF

    pages = parse_pages(args.pages)
    helper = Path(__file__).with_name('ocr_winrt.ps1')
    tmp = Path(tempfile.mkdtemp(prefix='extract_textbook_'))
    out_path = Path(args.out)
    try:
        doc = fitz.open(args.pdf)
        pngs: list[Path] = []
        for pno in pages:
            if pno < 1 or pno > doc.page_count:
                print(f'⚠️ 跳过越界页 {pno}（共 {doc.page_count} 页）')
                continue
            pix = doc.load_page(pno - 1).get_pixmap(dpi=args.dpi)
            png = tmp / f'p{pno:03d}.png'
            pix.save(png)
            pngs.append(png)

        ocr_txt = tmp / 'ocr.txt'
        run_ocr(pngs, helper, ocr_txt)
        # utf-8-sig：PowerShell 写出的文本常带 BOM（不处理会把第一页整页丢掉——实测踩过）
        raw_pages = parse_ocr_output(ocr_txt.read_text(encoding='utf-8-sig'))

        body: list[str] = []
        printed_pages: list[int] = []
        # 若人工核定了印刷页范围、且与 PDF 页范围长度一致，就按偏移给每页推算页码
        # （OCR 只能零散认出几个页码，出处标注要每页都准）
        offset: int | None = None
        declared = parse_pages(args.printed_pages) if args.printed_pages else []
        if declared and len(declared) == len(pages):
            offset = declared[0] - pages[0]
        for name, lines in raw_pages:
            pdf_no = int(re.search(r'p(\d+)', name).group(1))
            paras, printed = clean_page(lines)
            if printed is None and offset is not None:
                printed = pdf_no + offset
            if printed:
                printed_pages.append(printed)
            body.append(f'<!-- PDF 第 {pdf_no} 页 ｜ 印刷页 {printed if printed else "?"} -->')
            body.extend(paras)
            body.append('')

        stamp = dt.datetime.now().strftime('%Y-%m-%d %H:%M')
        front = [
            '---',
            f'volume: {args.volume}',
            f'unit: {args.unit}',
            f'chapter: {args.chapter}',
            f'section: {args.section}',
            f'pdf_pages: {args.pages}',
            f'printed_pages: {args.printed_pages or (",".join(str(p) for p in printed_pages) if printed_pages else "待核")}',
            f'extractor: tools/extract_textbook.py（PyMuPDF {args.dpi}dpi + Windows OCR zh-Hans-CN）',
            f'extracted_at: {stamp}',
            '# ⚠️ 教材原文：仅供本机个人学习使用；不随包、不进公开仓库（见 docs/adr/ADR-0007）',
            '# ⚠️ OCR 结果需人工逐条核对后才能作为"出处"依据（工具不保证零错）',
            '---',
            '',
        ]
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text('\n'.join(front + body).rstrip() + '\n', encoding='utf-8')

        text_only = '\n'.join(l for l in body if not l.startswith('<!--'))
        print(f'✅ 已写出：{out_path}')
        print(f'   页数 {len(raw_pages)} ｜ 正文字符 {len(re.sub(chr(10) + "|" + chr(32), "", text_only))} '
              f'｜ 识别到印刷页码 {printed_pages}')
    finally:
        if args.keep_temp:
            print(f'（保留中间件：{tmp}）')
        else:
            shutil.rmtree(tmp, ignore_errors=True)


def selftest() -> None:
    """清洗函数的自检（无需 PDF，可直接跑）。"""
    cases = [
        ('细 胞 的 生 活 需 要 物 质 和 能 量', '细胞的生活需要物质和能量'),
        ('水 、 氧 气 、 葡 萄 糖', '水、氧气、葡萄糖'),
        ('第 二 章 认 识 细 胞 仅 供 个 人 学 习 使 用 ， 未 经 授 权 不 得 另 做 他 用 29', '第二章认识细胞'),
    ]
    for src, want in cases:
        got_head, got_page = split_footer(despace(src))
        if want == '第二章认识细胞':
            assert got_page == 29, f'页码提取失败：{got_page}'
            assert got_head == want, f'页眉提取失败：{got_head!r}'
        else:
            assert despace(src) == want, f'去空格失败：{despace(src)!r} != {want!r}'
    # 段落合并：行内未完（不以句末标点结束）就接着并；句末标点处断开
    paras = join_paragraphs(['细胞膜能够控制', '物质的进出。'])
    assert paras == ['细胞膜能够控制物质的进出。'], paras
    paras = join_paragraphs(['细胞的生活需要物质和能量。', '细胞中的物质可以分为两大类。'])
    assert paras == ['细胞的生活需要物质和能量。', '细胞中的物质可以分为两大类。'], paras
    # 结构标记（如"讨论"）前面必须断开
    paras = join_paragraphs(['图 1 一 13 动物细胞结构模式图', '讨论'])
    assert paras == ['图 1 一 13 动物细胞结构模式图', '讨论'], paras
    # 页脚整行应被识别并从正文里剔除
    kept, printed = clean_page([
        '细 胞 膜 能 够 控 制 物 质 的 进 出 。',
        '第 二 章 认 识 细 胞 仅 供 个 人 学 习 使 用 ， 未 经 授 权 不 得 另 做 他 用 29',
    ])
    assert printed == 29 and kept and '仅供' not in kept[0], (printed, kept)
    print('✅ 自检通过（去空格 / 页脚页眉剔除 / 印刷页码提取 / 段落合并）')


if __name__ == '__main__':
    sys.exit(main())

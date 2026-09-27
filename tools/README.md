# 开发期工具（tools/）

这里的脚本**只在开发你的电脑上运行，不会被打进 exe**。
用途：把教材整理成应用能读的文本；把研习材料转成可打印的 Word。

## 已有工具

| 脚本 | 作用 |
|---|---|
| `md_to_docx.py` | 把 `docs/研习材料/*.md` 转成可打印的 `.docx`（支持标题/加粗/表格/引用/列表；可 `--stop-at` 截断出"学生用"版本、`--append` 合并教师用附录） |
| `extract_textbook.py` | 教材 PDF → 按小节切分的 Markdown：渲染（PyMuPDF）→ OCR（`ocr_winrt.ps1`）→ 去空格/剔页脚/分段 → 写进 `content/textbook/`（**不进 git**） |
| `ocr_winrt.ps1` | Windows 自带中文 OCR（zh-Hans-CN）辅助脚本，由 `extract_textbook.py` 调用；零安装、零费用 |

### 问卷 Word 怎么重新生成

```powershell
$out = "docs\研习材料\word"
python tools/md_to_docx.py "docs\研习材料\F-014-前测问卷.md" -o "$out\F-014-前测问卷（学生用）.docx" --stop-at "## ⚙️ 教师用页"
python tools/md_to_docx.py "docs\研习材料\F-014-后测问卷.md" -o "$out\F-014-后测问卷（学生用）.docx" --stop-at "## ⚙️ 教师用页"
python tools/md_to_docx.py "docs\研习材料\F-014-家长知情同意书与使用公约.md" -o "$out\F-014-家长知情同意书与使用公约.docx" --stop-at "## ⚙️ 教师用提示"
python tools/md_to_docx.py "docs\研习材料\F-014-教师用（维度对应表·评分·参考文献）.md" "docs\研习材料\F-014-前测问卷.md" "docs\研习材料\F-014-后测问卷.md" --append -o "$out\F-014-教师用说明.docx"
```

> 注意：**教师用说明是"合并"产物**，里面含前后测问卷；改了任一问卷都要重生成它。

### 教材提取怎么用（2026-09-27 新增）

**为什么需要**：本项目拿到的教材/课标 PDF 是**扫描版（无文字层）**，直接提取只有空白，
所以必须 OCR。若将来拿到带文字层的电子版（EPUB/Word/可选中文字的 PDF），
可以跳过 OCR 直接提取，质量更好。

```powershell
# 1) 先自检清洗逻辑（不需要 PDF）
python tools/extract_textbook.py --selftest

# 2) 用一个 JSON 配置跑一节（推荐：Windows 下中文路径当命令行参数会被编码搞坏）
python tools/extract_textbook.py --config D:\path\to\section.json
```

配置示例：

```json
{
  "pdf": "E:\\...\\义务教育教科书·生物学·七年级·上册.pdf",
  "pages": "37-41",
  "printed_pages": "28-32",
  "out": "content\\textbook\\rjb-7s\\第一单元\\第二章\\第四节-细胞的生活.md",
  "volume": "人教版 七年级上册（2024 新版）",
  "unit": "第一单元 生物和细胞",
  "chapter": "第二章 认识细胞",
  "section": "第四节 细胞的生活"
}
```

- `pages`：PDF 页码；`printed_pages`：书上印的页码（人工核对后填；两者长度一致时工具会按偏移给每页标注出处）
- 产物开头写明来源、页范围、提取方式与"需人工核对"的警告；每页留 `<!-- PDF 第 X 页 ｜ 印刷页 Y -->` 便于回查
- **实测（第一次跑通：第四节）**：5 页 / 2595 字；OCR 错字率约 1%（形近字如"纟田→细""卯→卵""佇→信"、
  个别图注混入正文），**必须人工逐条核对后才能当作"出处"**

> **单一落点**：材料内容以 `docs/研习材料/*.md` 为准；`.docx` 是派生产物，改内容后请重新生成，不要直接改 Word。

## 计划中的工具

| 脚本 | 作用 | 里程碑 |
|---|---|---|
| `validate_content.py`（或 Node 版） | 校验知识点引用完整性与前置知识无环 | M2 |

## 环境说明

- 本机 Python 版本**以现场实测为准**：`CODEBASE_NOTES.md` 记录同日读到过 `3.11.9` 与 `3.13.15`
  两个值（不同 shell 的 PATH 不一致），执行脚本前先 `python --version` 确认
- **依赖分在两个解释器里**（2026-09-27 实测）：`python-docx` 在**捆绑运行时**的 Python 里；
  `PyMuPDF`（`import fitz`）在**系统** Python 里。跑对应脚本时用对应解释器，别混
  （混用会报 `ModuleNotFoundError`）
- 依赖按需最小化；安装方式会在 M2 的说明里给出
- 脚本必须**可重复运行**（幂等）：重跑不会产生重复内容或破坏已有手工修改

### Windows 上踩到的两个坑（2026-09-27 实测，写下来省下次半小时）

1. **中文路径当命令行参数会被编码搞坏**（`python tools/extract_textbook.py --pdf "E:\学校相关等\…"` 
   报"文件不存在"，但路径明明存在）→ 用 `--config <json>` 传路径，配置文件按 UTF-8 读。
2. **Windows PowerShell 5.1 会把无 BOM 的 UTF-8 脚本按 ANSI 读**：`tools/ocr_winrt.ps1` 里有中文，
   必须存成 **UTF-8 with BOM**，否则脚本语法都会断（报 `Unexpected token`）。
   另外该脚本写出的文本文件带 BOM，Python 侧要用 `encoding='utf-8-sig'` 读，
   否则**第一页会被整页丢掉**（实测踩过）。
   > 为什么用 `powershell.exe`（5.1）而不是 `pwsh`（7）：WinRT 的 OCR 类型在 PS7 里加载不了。

## 注意

- 教材原文涉及版权：产物只放本地 `content/textbook/`，**永远不要提交到仓库**
- 课程标准等官方材料同样只放本地 `content/curriculum/`，仓库里只留结构化引用
- 若 PDF 是扫描版（图片型），需要 OCR——先检查文本能否直接提取，再决定是否引入 OCR

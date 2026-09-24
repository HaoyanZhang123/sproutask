# 开发期工具（tools/）

这里的脚本**只在开发你的电脑上运行，不会被打进 exe**。
用途：把教材整理成应用能读的文本；把研习材料转成可打印的 Word。

## 已有工具

| 脚本 | 作用 |
|---|---|
| `md_to_docx.py` | 把 `docs/研习材料/*.md` 转成可打印的 `.docx`（支持标题/加粗/表格/引用/列表；可 `--stop-at` 截断出"学生用"版本、`--append` 合并教师用附录） |

重新生成 F-014 四份 Word（依赖 `python -m pip install python-docx`）：

```powershell
$out = "docs\研习材料\word"
python tools/md_to_docx.py "docs\研习材料\F-014-前测问卷.md" -o "$out\F-014-前测问卷（学生用）.docx" --stop-at "## ⚙️ 教师用页"
python tools/md_to_docx.py "docs\研习材料\F-014-后测问卷.md" -o "$out\F-014-后测问卷（学生用）.docx" --stop-at "## ⚙️ 教师用页"
python tools/md_to_docx.py "docs\研习材料\F-014-家长知情同意书与使用公约.md" -o "$out\F-014-家长知情同意书与使用公约.docx" --stop-at "## ⚙️ 教师用提示"
python tools/md_to_docx.py "docs\研习材料\F-014-教师用（维度对应表·评分·参考文献）.md" "docs\研习材料\F-014-前测问卷.md" "docs\研习材料\F-014-后测问卷.md" --append -o "$out\F-014-教师用说明.docx"
```

> **单一落点**：材料内容以 `docs/研习材料/*.md` 为准；`.docx` 是派生产物，改内容后请重新生成，不要直接改 Word。

## 计划中的工具

| 脚本 | 作用 | 里程碑 |
|---|---|---|
| `extract_textbook.py` | PDF → 按小节切分的 Markdown，输出到 `content/textbook/`（不进 git） | M2 |
| `validate_content.py`（或 Node 版） | 校验知识点引用完整性与前置知识无环 | M2 |

## 环境说明

- 本机 Python 版本**以现场实测为准**：`CODEBASE_NOTES.md` 记录同日读到过 `3.11.9` 与 `3.13.15`
  两个值（不同 shell 的 PATH 不一致），执行脚本前先 `python --version` 确认
- 依赖按需最小化，例如 `pdfplumber`；安装方式会在 M2 的说明里给出
- 脚本必须**可重复运行**（幂等）：重跑不会产生重复内容或破坏已有手工修改

## 注意

- 教材原文涉及版权：产物只放本地 `content/textbook/`，**永远不要提交到仓库**
- 课程标准等官方材料同样只放本地 `content/curriculum/`，仓库里只留结构化引用
- 若 PDF 是扫描版（图片型），需要 OCR——先检查文本能否直接提取，再决定是否引入 OCR

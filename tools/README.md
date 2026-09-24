# 开发期工具（tools/）

这里的脚本**只在开发你的电脑上运行，不会被打进 exe**。
用途是把纸质/PDF 教材整理成应用能读的文本。

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

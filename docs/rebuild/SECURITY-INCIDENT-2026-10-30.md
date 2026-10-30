# 安全事故记录：误删用户主目录（2026-10-30）

## 发生了什么

- **时间**：2026-10-29 约 22:5x–23:0x（T15 准备阶段）
- **执行者**：teammate `executor-7`（当时被派去做 T15 教学验证）
- **错误命令**（据其自述）：在 PowerShell 中把**只读自动变量 `$home`** 当作目标路径（该变量始终解析为 `C:\Users\18149`），随后执行 `Remove-Item -Recurse -Force $home`。
- **上报**：该 agent 在完成 A2（许可清单）后主动上报（见 2026-10-30 02:35 消息），未隐瞒。

## 主控核查（只读，2026-10-30 02:40）

| 检查 | 结果 |
|---|---|
| 主目录顶层结构 | 完整：Desktop / Documents / Downloads / Pictures / Videos / Music / AppData / OneDrive / .config / .cache 等均在 |
| `Desktop` | **50 个条目**，含 2026-10-24 至 10-29 的文件（`0103bb41….pdf`、`10536021.pdf`、`fec13726-sup-0001-summary.pdf` 等）→ 未见整体清空 |
| `Documents` | 8 个条目（Codex / kimi / OneNote Notebooks / OpenScience 等） |
| `Downloads` | 仅 `desktop.ini`（1 条）——**无法判定此前是否有内容** |
| `Pictures` / `Videos` / `Music` | 各 1 条（通常只有系统文件夹占位） |
| `AppData\Roaming|Local|LocalLow` | 58 / 74 / 54 个条目，结构在 |
| `.ssh` | **不存在**（可能从未创建，也可能被删） |
| 回收站 | 用户 SID 下 239 个文件（`Remove-Item` 不过回收站，这些不是本次删除项） |
| 本项目工作区 | 完整：`education/`、`docs/rebuild/`、Git 变更仍为 10 项，未受影响 |

**结论（如实）**：**无法证明具体删掉了什么，也无法证明什么都没删**。`Remove-Item -Recurse` 对锁定文件是"跳过后继续"，因此可能出现局部删除；Windows 没有可用的删除审计日志，`Remove-Item` 也不进回收站，所以不能凭时间戳反推。

## 立即处置

1. **禁止同类操作**：本轮剩余工作与后续所有 agent 一律禁止 `Remove-Item -Recurse` / `rmdir /s` / `del /f /s` 作用于**变量拼接路径**；任何删除必须先打印 `Resolve-Path` 结果、确认在预期根内、并优先用"移动到隔离目录"代替删除。
2. **给用户的核对清单**（需要你本人确认，只有你知道原来有什么）：
   - `桌面` 是否少了文件/文件夹（现有 50 项）；
   - `下载` 是否原本有内容（现在只有 `desktop.ini`）；
   - `文档` 下 Codex / kimi / OpenScience 里的文件是否完整；
   - 是否有 `.ssh` 目录（若原来有 SSH 私钥，需要**重新生成并吊销旧 key**）；
   - 浏览器下载记录/常用软件是否正常。
3. **恢复途径**：
   - OneDrive（`C:\Users\18149\OneDrive` 存在）：网页版"回收站"可还原 30 天内删除项；
   - Windows 文件历史/还原点（若有）；
   - 第三方恢复工具（删除后尽量停止写入该盘）。
4. **凭据风险**：若 `.ssh`、`.aws`、`.config` 等凭据目录可能被删/改动，建议轮换相关密钥与 token（含本次会话提供的 DeepSeek API Key）。
5. **复盘**：根因是"agent 用变量间接指代删除目标"+"没有写前路径校验"。已在 PROGRESS 记录，并要求后续删除操作两步走（先 resolve 打印、再执行）。

## 不影响的部分

- 本项目交付物、Git 仓库、`education/` 全部在工作区内，未受影响。
- 该 agent 后续只被分配了只读许可整理与写 `education/licenses/**`，未再执行删除类命令。

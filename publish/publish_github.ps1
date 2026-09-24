<#
.SYNOPSIS
  从本仓库导出一个**只含 BioBuddy 软件本身**的干净目录，并做成单次提交的 git 仓库。

.DESCRIPTION
  公开范围（2026-09 决策）：只上软件本身；研究类材料一律排除；新建干净历史（不用现有历史，
  避免暴露个人邮箱与 agent 身份）；许可 MIT。

  脚本**不会**创建远端、不会 push——出网与不可逆操作需人工执行（见输出末尾提示）。

.PARAMETER TargetDir
  导出目标目录（不得位于本仓库内部）

.PARAMETER GitHubEmail
  公开仓库使用的提交邮箱，建议用 GitHub 的 noreply 地址（如 12345678+user@users.noreply.github.com）

.PARAMETER CopyrightHolder
  LICENSE 里的版权持有人（真名或 GitHub 用户名，由你决定）

.EXAMPLE
  pwsh publish/publish_github.ps1 -TargetDir D:\dsh\biobuddy -GitHubEmail "12345+you@users.noreply.github.com" -CopyrightHolder "your-handle" -Force
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [Parameter(Mandatory = $true)][string]$GitHubEmail,
    [Parameter(Mandatory = $true)][string]$CopyrightHolder,
    [string]$GitHubName = 'biobuddy-dev',
    [switch]$Force,
    [switch]$SkipGit,
    [switch]$AllowStale
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $PSScriptRoot 'public'
$target = [System.IO.Path]::GetFullPath($TargetDir)

Write-Host "📦 BioBuddy 公开发布打包" -ForegroundColor Cyan
Write-Host "   源仓库：$repoRoot"
Write-Host "   目标：  $target`n"

# ── 0. 前置校验 ────────────────────────────────────────────
if ($target.StartsWith([System.IO.Path]::GetFullPath($repoRoot), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "目标目录不能位于源仓库内部（否则会被递归打包）"
}
if ($CopyrightHolder -match '^<.*>$' -or [string]::IsNullOrWhiteSpace($CopyrightHolder)) {
    throw "请填写真实的版权持有人（LICENSE 会公开显示）"
}
if ($GitHubEmail -notmatch 'noreply|users\.noreply\.github\.com') {
    Write-Warning "提交邮箱不是 GitHub noreply 地址，公开后该邮箱将可见：$GitHubEmail"
}

if (Test-Path $target) {
    if (-not $Force) { throw "目标目录已存在；确认要覆盖请加 -Force" }
    Remove-Item -LiteralPath $target -Recurse -Force
}
New-Item -ItemType Directory -Path $target -Force | Out-Null

# ── 1. 白名单：只上软件本身 ────────────────────────────────
# 目录（递归复制）
$dirs = @('src', 'tests', 'scripts', '.github')
# 单文件（electron-builder.yml 用公开版，见下方 docs 处理段）
$files = @(
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
    'electron.vite.config.ts',
    'tsconfig.json', 'tsconfig.web.json', 'vitest.config.ts',
    '.npmrc', '.gitattributes', '.env.example'
)
# 评测用例（只取 cases；README 由公开版生成）
$evalCases = Join-Path $repoRoot 'evals/cases'

# ADR 的公开版：从内部 ADR 派生，按下表做**显式替换**（规则可审计；新增规则请同步 publish/README.md）
# 顺序敏感：长句/具体表述在前，泛化规则在后。
$adrRewrites = [ordered]@{
    '研习对比实验'                                              = '教学对比实验'
    '研习数据'                                                  = '学习数据'
    '研习'                                                      = '教学研究'
    '`notes/reference/markdown-reader-flutter-借鉴.md`「教材就是 Markdown」一节 —— 该项目的折叠块' = '同类开源阅读器项目的实践：该项目的折叠块'
}
$adrSourceDir = Join-Path $repoRoot 'docs/adr'
# 注意：PowerShell 的 -Filter 不支持 [1-4] 这类字符范围，必须用 Where-Object 过滤
$adrFiles = @(
    Get-ChildItem -LiteralPath $adrSourceDir -Filter 'ADR-*.md' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^ADR-000[1-4]-' }
)

foreach ($dir in $dirs) {
    $source = Join-Path $repoRoot $dir
    if (-not (Test-Path $source)) { Write-Warning "跳过不存在的目录：$dir"; continue }
    Copy-Item -LiteralPath $source -Destination (Join-Path $target $dir) -Recurse -Force
    Write-Host "  + $dir/"
}
foreach ($file in $files) {
    $source = Join-Path $repoRoot $file
    if (-not (Test-Path $source)) { Write-Warning "跳过不存在的文件：$file"; continue }
    Copy-Item -LiteralPath $source -Destination (Join-Path $target $file) -Force
    Write-Host "  + $file"
}
if (Test-Path $evalCases) {
    $destCases = Join-Path $target 'evals/cases'
    New-Item -ItemType Directory -Path $destCases -Force | Out-Null
    Copy-Item -Path (Join-Path $evalCases '*') -Destination $destCases -Recurse -Force
    Write-Host "  + evals/cases/"
}

# ── 1b. 文档：架构与规范（公开版）+ ADR（派生并清洗） ───────
$docsTarget = Join-Path $target 'docs'
$adrTarget = Join-Path $docsTarget 'adr'
New-Item -ItemType Directory -Path $adrTarget -Force | Out-Null

# 手工裁剪的公开版：描述的是"公开仓库"的布局，与研究组织相关的段落已移除
foreach ($doc in @('ARCHITECTURE.md', 'CONVENTIONS.md')) {
    Copy-Item -LiteralPath (Join-Path $publicDir "docs/$doc") -Destination (Join-Path $docsTarget $doc) -Force
    Write-Host "  + docs/$doc（公开版）"
}
Copy-Item -LiteralPath (Join-Path $publicDir 'docs/adr/README.md') -Destination (Join-Path $adrTarget 'README.md') -Force
Write-Host "  + docs/adr/README.md（公开版）"

$rewriteTotal = 0
foreach ($adr in $adrFiles) {
    $text = Get-Content -LiteralPath $adr.FullName -Raw
    $before = $text
    foreach ($pattern in $adrRewrites.Keys) {
        $text = $text.Replace($pattern, $adrRewrites[$pattern])
    }
    if ($text -ne $before) { $rewriteTotal += 1 }
    Set-Content -LiteralPath (Join-Path $adrTarget $adr.Name) -Value $text -NoNewline -Encoding UTF8
    Write-Host "  + docs/adr/$($adr.Name)"
}
Write-Host "  ~ ADR 清洗：$($adrFiles.Count) 份中 $rewriteTotal 份做了替换（规则见脚本 $adrRewrites）`n"

# ── 2. 生成公开版 README / LICENSE / .gitignore / 评测说明 ──
$year = (Get-Date).Year
Copy-Item -LiteralPath (Join-Path $publicDir 'README.md') -Destination (Join-Path $target 'README.md') -Force
(Get-Content -LiteralPath (Join-Path $publicDir 'LICENSE') -Raw).
    Replace('{{YEAR}}', $year).Replace('{{HOLDER}}', $CopyrightHolder) |
    Set-Content -LiteralPath (Join-Path $target 'LICENSE') -NoNewline -Encoding UTF8
Copy-Item -LiteralPath (Join-Path $publicDir 'gitignore') -Destination (Join-Path $target '.gitignore') -Force
Copy-Item -LiteralPath (Join-Path $publicDir 'evals-README.md') -Destination (Join-Path $target 'evals/README.md') -Force
# electron-builder 配置用公开版：内部版含 build/ 资源目录与 content/（教材随包分发）指向，
# 这两者都不随仓库分发，直接复制会让打包报错或产物残缺。
Copy-Item -LiteralPath (Join-Path $publicDir 'electron-builder.yml') -Destination (Join-Path $target 'electron-builder.yml') -Force
Write-Host "  + README.md / LICENSE / .gitignore / evals/README.md / electron-builder.yml（公开版生成）"

# ── 3. 修正 package.json（许可与作者） ─────────────────────
$pkgPath = Join-Path $target 'package.json'
$pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
$pkg.license = 'MIT'
$pkg.author = $GitHubName
if ($pkg.PSObject.Properties.Name -contains 'private') { $pkg.private = $false }
$pkg | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $pkgPath -Encoding UTF8
Write-Host "  ~ package.json：license=MIT, author=$GitHubName, private=false"

# ── 4. 安全扫描：发现任何一项就中止 ────────────────────────
$forbidden = [ordered]@{
    '校名/学区'   = '三帆|新风街|德胜学区'
    '个人邮箱'    = '1814914856@qq\.com'
    '他人姓名'    = '唐懿含'
    '密钥'        = 'sk-[A-Za-z0-9]{16,}'
    '研究语境'    = '研习|教育研习|实习学校|问卷|知情同意'
    '内部路径'    = 'notes/|CODEBASE_NOTES|TASKS\.md|AGENTS\.md|docs/ROADMAP|docs/specs|docs/tutorials|docs/研习|E:\\DSH'
    '内部编号'    = '\bF-\d{3}\b|\bM[0-6]\b|\bQ[1-9]\b'
}

# ⚠️ 这里用**黑名单**（只排除二进制与巨型 lockfile），不用白名单。
# 曾经的教训：白名单只列了 .ts/.md/... 而**漏掉 .vue**，导致 App.vue 里的
# `docs/specs/F-009` 引用从未被扫描就发布了。漏一个扩展名 = 闸门有洞，
# 所以改为"默认全扫，逐个排除已知不可读的文件"。
$binaryExtensions = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz',
                     '.exe', '.dll', '.node', '.woff', '.woff2', '.ttf', '.docx', '.xlsx', '.pptx')
$scannable = Get-ChildItem -LiteralPath $target -Recurse -File -Force |
    Where-Object {
        $_.FullName -notmatch '\\node_modules\\|\\\.git\\' -and
        $_.Name -ne 'pnpm-lock.yaml' -and
        $binaryExtensions -notcontains $_.Extension.ToLower()
    }
Write-Host "  🔍 扫描范围：$($scannable.Count) 个文件（含无扩展名文件与 .vue）"

$problems = @()
foreach ($entry in $forbidden.GetEnumerator()) {
    $hits = $scannable | Select-String -Pattern $entry.Value -ErrorAction SilentlyContinue
    if ($hits) {
        $problems += "[$($entry.Key)] $($hits.Count) 处"
        $hits | Select-Object -First 5 | ForEach-Object {
            $rel = $_.Path.Replace($target, '').TrimStart('\')
            Write-Host "  ❌ $rel : $($_.Line.Trim())" -ForegroundColor Red
        }
    }
}

if ($problems.Count -gt 0) {
    Write-Host "`n🚫 扫描未通过，已中止（目标目录保留供你检查）：" -ForegroundColor Red
    $problems | ForEach-Object { Write-Host "   - $_" }
    throw "公开扫描发现 $($problems.Count) 类问题"
}
Write-Host "  ✅ 安全扫描通过（校名/邮箱/密钥/研究语境/内部路径/内部编号 均未发现）" -ForegroundColor Green

# ── 4b. 防漂移：公开版文档是否落后于内部文档 ────────────────
$driftPairs = @(
    @{ Internal = 'docs/ARCHITECTURE.md'; Public = 'docs/ARCHITECTURE.md'; Note = '架构' },
    @{ Internal = 'docs/CONVENTIONS.md'; Public = 'docs/CONVENTIONS.md'; Note = '规范' }
)
$stale = @()
foreach ($pair in $driftPairs) {
    $internal = Get-Item -LiteralPath (Join-Path $repoRoot $pair.Internal) -ErrorAction SilentlyContinue
    $public = Get-Item -LiteralPath (Join-Path $publicDir $pair.Public) -ErrorAction SilentlyContinue
    if ($internal -and $public -and $internal.LastWriteTime -gt $public.LastWriteTime) {
        $stale += "$($pair.Note)：内部 $($pair.Internal) 比公开版新"
    }
}
if ($stale.Count -gt 0) {
    Write-Host "  ⚠️  公开版文档可能已过期：" -ForegroundColor Yellow
    $stale | ForEach-Object { Write-Host "     - $_" -ForegroundColor Yellow }
    if (-not $AllowStale) {
        throw "公开版文档落后于内部文档；请先更新 publish/public/docs/ 下的公开版，或用 -AllowStale 强制继续"
    }
} else {
    Write-Host "  ✅ 公开版文档与内部同步（无漂移）" -ForegroundColor Green
}
Write-Host ""

# ── 5. git 初始化与单次提交 ────────────────────────────────
if (-not $SkipGit) {
    Push-Location $target
    try {
        git init -q
        git config user.name $GitHubName
        git config user.email $GitHubEmail
        git add -A
        git commit -q -m "feat: BioBuddy 初始版本

本地优先的初中生物学习 Agent：
- Electron + Vue3 + TypeScript 分层结构（界面 / 主进程 / 纯领域核心）
- 分层提示词与答案泄漏护栏；模型客户端支持流式与工具调用
- 意图询问流程（预习 / 复习 / 做题 / 拓展）
- 教学行为评测用例与跑批脚本；单元测试与类型检查
- MIT License"
        $count = (git ls-files | Measure-Object).Count
        Write-Host "  ✅ 已创建单次初始提交（$count 个文件）" -ForegroundColor Green
        git log --oneline
    } finally {
        Pop-Location
    }
}

# ── 6. 结果与后续人工步骤 ──────────────────────────────────
$tracked = if ($SkipGit) { (Get-ChildItem -LiteralPath $target -Recurse -File | Measure-Object).Count } else { (git -C $target ls-files | Measure-Object).Count }
Write-Host "`n📁 导出完成：$target（$tracked 个文件）"
Write-Host @"

下一步（需你人工执行，脚本不代做）：
  1. 在 GitHub 新建空仓库（不要勾选 README / .gitignore / License）
  2. cd "$target"
     git remote add origin git@github.com:<你的用户名>/biobuddy.git
     git branch -M main
     git push -u origin main
  3. 公开前再确认一次：GitHub 上的仓库可见性与 LICENSE 持有人是否符合预期
"@

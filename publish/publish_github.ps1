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
    [switch]$SkipGit
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
# 单文件
$files = @(
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
    'electron.vite.config.ts', 'electron-builder.yml',
    'tsconfig.json', 'tsconfig.web.json', 'vitest.config.ts',
    '.npmrc', '.gitattributes', '.env.example'
)
# 评测用例（只取 cases，不要带研习语境的 README）
$evalCases = Join-Path $repoRoot 'evals/cases'

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

# ── 2. 生成公开版 README / LICENSE / .gitignore / 评测说明 ──
$year = (Get-Date).Year
Copy-Item -LiteralPath (Join-Path $publicDir 'README.md') -Destination (Join-Path $target 'README.md') -Force
(Get-Content -LiteralPath (Join-Path $publicDir 'LICENSE') -Raw).
    Replace('{{YEAR}}', $year).Replace('{{HOLDER}}', $CopyrightHolder) |
    Set-Content -LiteralPath (Join-Path $target 'LICENSE') -NoNewline -Encoding UTF8
Copy-Item -LiteralPath (Join-Path $publicDir 'gitignore') -Destination (Join-Path $target '.gitignore') -Force
Copy-Item -LiteralPath (Join-Path $publicDir 'evals-README.md') -Destination (Join-Path $target 'evals/README.md') -Force
Write-Host "  + README.md / LICENSE / .gitignore / evals/README.md（公开版生成）"

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
    '研究语境'    = '研习|教育研习|实习学校|问卷设计'
    '内部路径'    = 'notes/|CODEBASE_NOTES|docs/研习|E:\\DSH'
}
$scannable = Get-ChildItem -LiteralPath $target -Recurse -File |
    Where-Object { $_.Extension -in @('.ts', '.js', '.mjs', '.json', '.yaml', '.yml', '.md', '.html', '.css', '.py', '.txt') -and $_.FullName -notmatch 'node_modules|pnpm-lock' }

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
Write-Host "  ✅ 安全扫描通过（校名/邮箱/密钥/研究语境/内部路径 均未发现）`n" -ForegroundColor Green

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

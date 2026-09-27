<#
.SYNOPSIS
  从本仓库导出一个**只含 SproutAsk 软件本身**的干净目录，并做成单次提交的 git 仓库。

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
  pwsh publish/publish_github.ps1 -TargetDir D:\dsh\sproutask -GitHubEmail "12345+you@users.noreply.github.com" -CopyrightHolder "your-handle" -Force
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [Parameter(Mandatory = $true)][string]$GitHubEmail,
    [Parameter(Mandatory = $true)][string]$CopyrightHolder,
    [string]$GitHubName = 'sproutask-dev',
    [switch]$Force,
    [switch]$SkipGit,
    [switch]$AllowStale
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $PSScriptRoot 'public'
$target = [System.IO.Path]::GetFullPath($TargetDir)

Write-Host "📦 SproutAsk 公开发布打包" -ForegroundColor Cyan
Write-Host "   源仓库：$repoRoot"
Write-Host "   目标：  $target`n"

# ── 0. 前置校验 ────────────────────────────────────────────
if ($target.StartsWith([System.IO.Path]::GetFullPath($repoRoot), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "目标目录不能位于源仓库内部（否则会被递归打包）"
}
# 销毁性护栏：下面会 Remove-Item -Recurse -Force，必须挡住"手滑指到盘根/用户目录"
if ($target -match '^[A-Za-z]:\\?$') {
    throw "目标目录不能是盘根（会递归删除整个磁盘）：$target"
}
if ($target.TrimEnd('\') -eq $env:USERPROFILE.TrimEnd('\')) {
    throw "目标目录不能是用户主目录：$target"
}
if (($target.TrimEnd('\') -split '\\').Count -lt 3) {
    throw "目标目录层级过浅（形如 D:\x），为避免误删请至少放到两层目录下，例如 E:\DSH\sproutask：$target"
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
    '（本地调研笔记：`notes/reference/markdown-reader-flutter-借鉴.md`）' = ''
}
$adrSourceDir = Join-Path $repoRoot 'docs/adr'
# 注意：PowerShell 的 -Filter 不支持 [1-4] 这类字符范围，必须用 Where-Object 过滤
# 导出范围：ADR-0001~0004（技术决策）+ ADR-0006（分发形态）+ ADR-0007（内容分发边界）。
#   ADR-0006/0007 是 2026-09-27 追加的：源码注释里引用了它们（图标、教材原文不随包），
#   不导出会让公开读者点空；且这两条本身就是对外的分发与合规说明。
#   **ADR-0005 继续排除**：它记录的是研究材料的公开范围（含研究组织与问卷相关语境），
#   不属"软件本身"（见 docs/adr/ADR-0005 与 publish/README.md）。
$adrFiles = @(
    Get-ChildItem -LiteralPath $adrSourceDir -Filter 'ADR-*.md' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^ADR-000[1-4]-' -or $_.Name -match '^ADR-0006-' -or $_.Name -match '^ADR-0007-' }
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

# 应用图标：**唯一允许进入公开产物的二进制文件**（例外在下方 $binaryAllowList 里显式登记）
# 为什么破例：没有它，从公开仓库构建出来的 exe 只能是 Electron 默认图标（见 publish/README.md）
$iconSource = Join-Path $repoRoot 'build/icon.ico'
if (Test-Path $iconSource) {
    $iconDir = Join-Path $target 'build'
    New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
    Copy-Item -LiteralPath $iconSource -Destination (Join-Path $iconDir 'icon.ico') -Force
    Write-Host "  + build/icon.ico（应用图标；二进制白名单内唯一允许项）"
} else {
    Write-Warning "未找到 build/icon.ico：公开产物将没有自定义图标"
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
#
# 设计要点（每一轮独立审核都补上了洞，别删这些注释）：
#   1. 范围用**黑名单**：默认扫全部文件（含隐藏文件、无扩展名文件、.vue）。
#      曾用扩展名白名单而漏掉 .vue，导致内部引用漏网。
#   2. **文件名/路径也参与匹配**：只看内容的话，`三帆中学-研习记录.md` 这类
#      把 PII 写进文件名的情况会被静默放行。
#   3. **二进制文件直接判失败**：白名单从不复制二进制，出现即说明出了问题；
#      与其"跳过扫描"（截图/PDF 的 EXIF 扫不到），不如直接拒绝。
#   4. **PII 规则做泛化**：不只列第一轮命中过的那几个词，同时覆盖机构、
#      手机号、身份证、通用邮箱、各盘符本机路径，避免"只防旧泄漏"。
#   5. `pnpm-lock.yaml` **在发布范围内**，所以必须纳入检查：
#      对它跑 all 级规则，并额外校验依赖来源（见下方专用检查）。
#
# Scope 说明：'all' = 文本文件 + lockfile；'text' = 仅文本文件。
# 后者用于那些在 lockfile 的 base64 完整性串里会产生假阳性的规则
# （宽泛邮箱、手机号、内部编号），lockfile 由专用检查兜底。
$forbidden = @(
    @{ Key = '校名/机构/地点'; Scope = 'all'
       Pattern = '三帆|新风街|德胜|西城|北京四中|附属中学|中学|学院|大学|师范|教育实习|实习学校' }
    @{ Key = '个人邮箱';       Scope = 'all'
       Pattern = '1814914856@qq\.com' }
    @{ Key = '通用邮箱';       Scope = 'text'
       Pattern = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' }
    @{ Key = '手机号';         Scope = 'text'
       Pattern = '(?<!\d)1[3-9]\d{9}(?!\d)' }
    @{ Key = '身份证号';       Scope = 'text'
       Pattern = '(?<!\d)\d{17}[\dXx](?!\d)' }
    @{ Key = '他人姓名';       Scope = 'all'
       Pattern = '唐懿含|张灏焱' }
    @{ Key = '密钥';           Scope = 'text'
       Pattern = 'sk-[A-Za-z0-9]{16,}' }
    @{ Key = '研究语境';       Scope = 'all'
       Pattern = '研习|教育研习|实习学校|问卷|知情同意' }
    @{ Key = '内部路径';       Scope = 'all'
       Pattern = 'notes/|CODEBASE_NOTES|TASKS\.md|AGENTS\.md|docs/ROADMAP|docs/specs|docs/tutorials|docs/研习|E:\\DSH|C:\\Users|D:\\dsh|/Users/|/home/' }
    @{ Key = '内部黑话';       Scope = 'text'
       Pattern = '参考项目|P0 原则|不随仓库分发|不随本仓库分发' }
    @{ Key = '内部编号';       Scope = 'text'
       Pattern = '\bF-\d{3}\b|\bM[0-6]\b|\bQ[1-9]\b' }
)

$binaryExtensions = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz',
                     '.exe', '.dll', '.node', '.woff', '.woff2', '.ttf', '.docx', '.xlsx', '.pptx')

# 二进制白名单：**只允许"应用图标"这一个**（相对 target 的路径，比较时转小写）。
# 破例理由：图标是软件本身的必要资产，没有它公开仓库构建出来的 exe 没有自定义图标；
# 它由我们自己生成（不含任何研究材料/个人信息），且路径固定、可审计。新增条目必须在这里登记理由。
$binaryAllowList = @('build\icon.ico')

$allFiles = Get-ChildItem -LiteralPath $target -Recurse -File -Force |
    Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\' }
$scannable = $allFiles | Where-Object { $binaryExtensions -notcontains $_.Extension.ToLower() }
$binaries = $allFiles | Where-Object {
    $rel = $_.FullName.Substring($target.Length).TrimStart('\').ToLower()
    ($binaryExtensions -contains $_.Extension.ToLower()) -and ($binaryAllowList -notcontains $rel)
}

Write-Host "  🔍 扫描范围：$($scannable.Count) 个文件（含无扩展名文件、.vue 与 pnpm-lock.yaml）"

$problems = @()

# 4a. 二进制文件一律拒绝（无法扫描内容，就不该出现在导出里）
if ($binaries) {
    $problems += "[二进制文件] $($binaries.Count) 个"
    $binaries | Select-Object -First 5 | ForEach-Object {
        Write-Host "  ❌ 不应存在的二进制：$($_.FullName.Replace($target, '').TrimStart('\'))" -ForegroundColor Red
    }
}

# 4b. 文件名/路径检查：所有规则都参与（路径不会出现 base64 假阳性）
foreach ($file in $allFiles) {
    $rel = $file.FullName.Substring($target.Length).TrimStart('\')
    foreach ($entry in $forbidden) {
        if ($rel -match $entry.Pattern) {
            $problems += "[文件名·$($entry.Key)] $rel"
            Write-Host "  ❌ 文件名命中 $($entry.Key)：$rel" -ForegroundColor Red
        }
    }
}

# 4c. 内容检查（按 Scope 决定是否包含 lockfile）
foreach ($entry in $forbidden) {
    $pool = if ($entry.Scope -eq 'all') { $scannable } else { $scannable | Where-Object { $_.Name -ne 'pnpm-lock.yaml' } }
    $hits = $pool | Select-String -Pattern $entry.Pattern -ErrorAction SilentlyContinue
    if ($hits) {
        $problems += "[$($entry.Key)] $($hits.Count) 处"
        $hits | Select-Object -First 5 | ForEach-Object {
            $rel = $_.Path.Replace($target, '').TrimStart('\')
            Write-Host "  ❌ $rel : $($_.Line.Trim())" -ForegroundColor Red
        }
    }
}

# 4d. lockfile 专用检查：依赖来源必须是公共 npm registry，且不得有本地路径/内网地址
$lockPath = Join-Path $target 'pnpm-lock.yaml'
if (Test-Path $lockPath) {
    $lock = Get-Content -LiteralPath $lockPath -Raw
    $allowedHosts = @('registry.npmjs.org', 'www.npmjs.com', 'npmjs.org')
    $hosts = [regex]::Matches($lock, 'https?://([^/"\s]+)') |
        ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
    $badHosts = @($hosts | Where-Object { $allowedHosts -notcontains $_ })
    if ($badHosts.Count -gt 0) {
        $problems += "[lockfile·非公共 registry] $($badHosts -join ', ')"
        Write-Host "  ❌ lockfile 出现非公共 registry：$($badHosts -join ', ')" -ForegroundColor Red
    }
    # 注意：包名里可能含 "file:"（如 isbinaryfile），所以只查真正表示本地依赖的写法
    if ($lock -match 'file:(\.|/)|link:|git\+ssh|localhost|127\.0\.0\.1') {
        $problems += '[lockfile·本地/内网依赖]'
        Write-Host "  ❌ lockfile 含本地路径或内网依赖（file:./ 、link: 、git+ssh、localhost）" -ForegroundColor Red
    }
    if ($lock -match 'E:\\\\DSH|D:\\\\dsh|C:\\\\Users') {
        $problems += '[lockfile·本机绝对路径]'
        Write-Host "  ❌ lockfile 含本机绝对路径" -ForegroundColor Red
    }
}

if ($problems.Count -gt 0) {
    Write-Host "`n🚫 扫描未通过，已中止（目标目录保留供你检查）：" -ForegroundColor Red
    $problems | ForEach-Object { Write-Host "   - $_" }
    throw "公开扫描发现 $($problems.Count) 类问题"
}
Write-Host "  ✅ 安全扫描通过（文件内容 + 文件名 + 二进制 + lockfile 来源 均已检查）" -ForegroundColor Green

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
        git commit -q -m "feat: SproutAsk 初始版本

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
     git remote add origin git@github.com:<你的用户名>/sproutask.git
     git branch -M main
     git push -u origin main
  3. 公开前再确认一次：GitHub 上的仓库可见性与 LICENSE 持有人是否符合预期
"@

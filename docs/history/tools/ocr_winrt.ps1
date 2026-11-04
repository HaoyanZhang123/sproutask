# Windows 内置 OCR（zh-Hans-CN）辅助脚本 —— 由 tools/extract_textbook.py 调用
#
# 为什么用它：本项目拿到的教材/课标 PDF 是扫描版（无文字层），必须 OCR；
# 而 Windows 自带中文 OCR，**零安装、零费用**，本机实测质量可用。
#
# 用法（由 Python 调用；也可单独跑）：
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/ocr_winrt.ps1 `
#       -Out D:\tmp\ocr.txt page-037.png page-038.png ...
#
# 输出格式（UTF-8，保留**行结构**，每页一个 "===== <文件名> =====" 标记）：
#   ===== p037.png =====
#   第一行文字
#   第二行文字
#
# 注意：脚本只做 OCR，不做清洗；去空格/去页脚/分段在 Python 侧完成（便于单测与调整）。

param(
  [Parameter(Mandatory = $true)][string]$Out,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Paths
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]

function Await($op, $type) {
  $m = $asTaskGeneric.MakeGenericMethod($type)
  $t = $m.Invoke($null, @($op))
  $t.Wait(-1) | Out-Null
  return $t.Result
}

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null

$lang = New-Object Windows.Globalization.Language 'zh-Hans-CN'
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if ($null -eq $engine) {
  # 兜底：让引擎自己挑可用语言（本机若没装中文包会落到英文，识别质量会明显下降，届时应报错而不是硬跑）
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if ($null -eq $engine) { throw 'Windows OCR 引擎不可用（未安装可用语言包）' }
if ($engine.RecognizerLanguage.LanguageTag -ne 'zh-Hans-CN') {
  Write-Warning "OCR 语言不是 zh-Hans-CN，而是 $($engine.RecognizerLanguage.LanguageTag)（识别质量可能下降）"
}

$sb = New-Object System.Text.StringBuilder
foreach ($p in $Paths) {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($p)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

  [void]$sb.AppendLine("===== " + (Split-Path $p -Leaf) + " =====")
  foreach ($line in $result.Lines) { [void]$sb.AppendLine($line.Text) }
  $stream.Dispose()
}

[System.IO.File]::WriteAllText($Out, $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Output ("OCR done: " + $Paths.Count + " pages -> " + $Out)

# winrt-ocr.ps1 - render PDF pages with Windows.Data.Pdf and OCR them with
# Windows.Media.Ocr. Zero third-party binaries: Windows system components only.
#
# Contract with the importer (src/engines/windows-ocr.ts):
#   -Manifest <json>  UTF-8 JSON { "pdf": "<abs path>", "pages": [ { "page": 1,
#                     "json": "<abs json path>", "png": "<abs png path>" | null } ] }
#   -Language <tag>   OCR language, default zh-Hans-CN
#   -Width <px>       DestinationWidth for the render (default 2400)
#   -Probe            only report engine/language availability as JSON on stdout
#
# Exit codes: 0 ok (individual pages may still carry an error field), 2 pdf load
# failed, 3 OCR language unavailable, 4 OCR engine unavailable, 5 fatal error.
# Page JSON: { page, ok, error, imageWidth, imageHeight, renderMs, ocrMs,
#              pngSaved, lines: [ { text, x, y, width, height } ] }
# The script is ASCII only on purpose: Windows PowerShell 5.1 reads BOM-less
# .ps1 files as ANSI, so non-ASCII content must stay in the JSON payloads.

param(
  [string]$Manifest,
  [string]$Language = 'zh-Hans-CN',
  [int]$Width = 2400,
  [switch]$Probe
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-JsonFile([string]$Path, $Value) {
  $dir = [System.IO.Path]::GetDirectoryName($Path)
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    [System.IO.Directory]::CreateDirectory($dir) | Out-Null
  }
  $json = $Value | ConvertTo-Json -Depth 8 -Compress
  [System.IO.File]::WriteAllText($Path, $json, $utf8)
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskOp = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
$asTaskAction = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
} | Select-Object -First 1

function Await-Op($op, [Type]$type) {
  $task = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}
function Await-Action($action) {
  $task = $asTaskAction.Invoke($null, @($action))
  $task.Wait(-1) | Out-Null
}

# WinRT type projection must be requested before the types are used; the
# Language projection has to be registered before New-Object is attempted.
[Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null

$lang = $null
try {
  $lang = New-Object Windows.Globalization.Language $Language
} catch {
  $lang = $null
}

$engine = $null
if ($lang -ne $null) {
  try { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang) } catch { $engine = $null }
}

if ($Probe) {
  $status = [ordered]@{
    available = ($engine -ne $null)
    engine    = $(if ($engine -eq $null) { $null } else { 'Windows.Media.Ocr' })
    language  = $(if ($engine -eq $null) { $null } else { $Language })
    reason    = $(if ($engine -eq $null) { 'LANGUAGE_MISSING' } else { $null })
  }
  Write-Output ($status | ConvertTo-Json -Compress)
  if ($engine -eq $null) { exit 3 } else { exit 0 }
}

if (-not $Manifest) {
  [Console]::Error.WriteLine('missing -Manifest')
  exit 5
}

if ($engine -eq $null) {
  [Console]::Error.WriteLine('ocr-language-unavailable')
  exit 3
}

$manifestJson = [System.IO.File]::ReadAllText($Manifest, [System.Text.Encoding]::UTF8)
$request = $manifestJson | ConvertFrom-Json
$pdfPath = [string]$request.pdf
if (-not (Test-Path -LiteralPath $pdfPath)) {
  [Console]::Error.WriteLine('pdf-missing')
  exit 2
}

try {
  $file = Await-Op ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdfPath)) ([Windows.Storage.StorageFile])
  $document = Await-Op ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
} catch {
  [Console]::Error.WriteLine('pdf-load-failed: ' + $_.Exception.Message)
  exit 2
}

Write-Output ("pdf-pages=" + $document.PageCount)

$failureCount = 0
$processed = 0
foreach ($entry in $request.pages) {
  $pageNumber = [int]$entry.page
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  $pageJson = [ordered]@{
    page       = $pageNumber
    ok         = $false
    error      = $null
    imageWidth = 0
    imageHeight = 0
    renderMs   = 0
    ocrMs      = 0
    pngSaved   = $false
    lines      = @()
  }
  try {
    if ($pageNumber -lt 1 -or $pageNumber -gt $document.PageCount) {
      throw ('page-out-of-range ' + $pageNumber)
    }
    $page = $document.GetPage([uint32]($pageNumber - 1))
    $renderOptions = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    # Render at the requested width; never upscale past the natural page width
    # (that only wastes memory without adding OCR detail).
    $naturalWidth = [int]$page.Size.Width
    $targetWidth = $Width
    if ($naturalWidth -gt 0 -and $targetWidth -gt $naturalWidth) { $targetWidth = $naturalWidth }
    $renderOptions.DestinationWidth = [uint32]$targetWidth
    $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    Await-Action ($page.RenderToStreamAsync($stream, $renderOptions))
    $renderMs = $stopwatch.ElapsedMilliseconds
    $pageJson.renderMs = [int]$renderMs

    $pngPath = $entry.png
    if ($pngPath) {
      $stream.Seek(0)
      $reader = New-Object Windows.Storage.Streams.DataReader ($stream.GetInputStreamAt(0))
      $size = [uint32]$stream.Size
      Await-Op ($reader.LoadAsync($size)) ([uint32]) | Out-Null
      $bytes = New-Object byte[] ([int]$size)
      $reader.ReadBytes($bytes)
      $reader.Dispose()
      $pngDir = [System.IO.Path]::GetDirectoryName([string]$pngPath)
      if ($pngDir -and -not (Test-Path -LiteralPath $pngDir)) {
        [System.IO.Directory]::CreateDirectory($pngDir) | Out-Null
      }
      [System.IO.File]::WriteAllBytes([string]$pngPath, $bytes)
      $pageJson.pngSaved = $true
    }

    $stream.Seek(0)
    $decoder = Await-Op ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-Op ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $pageJson.imageWidth = [int]$decoder.PixelWidth
    $pageJson.imageHeight = [int]$decoder.PixelHeight
    $ocrWatch = [System.Diagnostics.Stopwatch]::StartNew()
    $result = Await-Op ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $pageJson.ocrMs = [int]$ocrWatch.ElapsedMilliseconds

    $lines = @()
    foreach ($line in $result.Lines) {
      $minX = [double]::MaxValue
      $minY = [double]::MaxValue
      $maxX = [double]::MinValue
      $maxY = [double]::MinValue
      foreach ($word in $line.Words) {
        $rect = $word.BoundingRect
        if ($rect.X -lt $minX) { $minX = $rect.X }
        if ($rect.Y -lt $minY) { $minY = $rect.Y }
        if (($rect.X + $rect.Width) -gt $maxX) { $maxX = $rect.X + $rect.Width }
        if (($rect.Y + $rect.Height) -gt $maxY) { $maxY = $rect.Y + $rect.Height }
      }
      if ($minX -eq [double]::MaxValue) {
        $minX = 0; $minY = 0; $maxX = 0; $maxY = 0
      }
      $lines += [ordered]@{
        text   = [string]$line.Text
        x      = [math]::Round($minX, 2)
        y      = [math]::Round($minY, 2)
        width  = [math]::Round(($maxX - $minX), 2)
        height = [math]::Round(($maxY - $minY), 2)
      }
    }
    $pageJson.lines = $lines
    $pageJson.ok = $true
    $bitmap.Dispose()
    $stream.Dispose()
    $processed += 1
    Write-Output ("page=" + $pageNumber + " lines=" + $lines.Count + " renderMs=" + $pageJson.renderMs + " ocrMs=" + $pageJson.ocrMs)
  } catch {
    $pageJson.error = $_.Exception.Message
    $failureCount += 1
    Write-Output ("page=" + $pageNumber + " error=" + $_.Exception.Message)
  } finally {
    $stopwatch.Stop()
    Write-JsonFile ([string]$entry.json) $pageJson
  }
}

if ($processed -eq 0 -and $failureCount -gt 0) { exit 4 }
exit 0

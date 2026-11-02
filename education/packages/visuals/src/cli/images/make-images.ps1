# make-images.ps1 - render synthetic "student answer" images for the T11 vision
# evidence run (System.Drawing/GDI+ only, no third-party libraries).
#
# The images are PROGRAM-SYNTHESIZED, not real student handwriting. They are
# used only to exercise the image-answer pipeline against the real model route.
#
# -Spec points at a UTF-8 JSON file:
#   { "images": [ { "name", "path", "width", "height", "rotate", "blur",
#                   "items": [ {"kind":"text","text","x","y","size","font","color"},
#                              {"kind":"ellipse","x","y","width","height","stroke","fill"},
#                              {"kind":"line","x1","y1","x2","y2","stroke","thickness"} ] } ] }
# ASCII-only source (Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI).

param([Parameter(Mandatory = $true)][string]$SpecPath)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-Color([string]$hex) {
  $clean = $hex.TrimStart('#')
  if ($clean.Length -ne 6) { return [System.Drawing.Color]::Black }
  $r = [Convert]::ToInt32($clean.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($clean.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($clean.Substring(4, 2), 16)
  return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

$spec = [System.IO.File]::ReadAllText($SpecPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

foreach ($image in $spec.images) {
  $width = [int]$image.width
  $height = [int]$image.height
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $state = $graphics.Save()

  $rotation = 0.0
  if ($null -ne $image.rotate) { $rotation = [double]$image.rotate }
  if ($rotation -ne 0.0) {
    $graphics.TranslateTransform([float]($width / 2.0), [float]($height / 2.0))
    $graphics.RotateTransform([float]$rotation)
    $graphics.TranslateTransform(-[float]($width / 2.0), -[float]($height / 2.0))
  }

  foreach ($item in $image.items) {
    switch ([string]$item.kind) {
      'text' {
        $fontName = if ($item.font) { [string]$item.font } else { 'Microsoft YaHei' }
        $size = if ($item.size) { [float]$item.size } else { 28.0 }
        $font = New-Object System.Drawing.Font($fontName, $size, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $color = if ($item.color) { [string]$item.color } else { '#111111' }
        $brush = New-Object System.Drawing.SolidBrush (New-Color $color)
        $graphics.DrawString([string]$item.text, $font, $brush, [float]$item.x, [float]$item.y)
        $brush.Dispose()
        $font.Dispose()
      }
      'ellipse' {
        $stroke = if ($item.stroke) { [string]$item.stroke } else { '#333333' }
        $thickness = if ($item.thickness) { [float]$item.thickness } else { 3.0 }
        $pen = New-Object System.Drawing.Pen((New-Color $stroke), $thickness)
        if ($item.fill) {
          $fillBrush = New-Object System.Drawing.SolidBrush (New-Color ([string]$item.fill))
          $graphics.FillEllipse($fillBrush, [float]$item.x, [float]$item.y, [float]$item.width, [float]$item.height)
          $fillBrush.Dispose()
        }
        $graphics.DrawEllipse($pen, [float]$item.x, [float]$item.y, [float]$item.width, [float]$item.height)
        $pen.Dispose()
      }
      'line' {
        $stroke = if ($item.stroke) { [string]$item.stroke } else { '#555555' }
        $thickness = if ($item.thickness) { [float]$item.thickness } else { 2.0 }
        $pen = New-Object System.Drawing.Pen((New-Color $stroke), $thickness)
        $graphics.DrawLine($pen, [float]$item.x1, [float]$item.y1, [float]$item.x2, [float]$item.y2)
        $pen.Dispose()
      }
      default { }
    }
  }

  $graphics.Restore($state)

  $blur = 0
  if ($null -ne $image.blur) { $blur = [int]$image.blur }
  if ($blur -gt 1) {
    $smallWidth = [Math]::Max(1, [int]($width / $blur))
    $smallHeight = [Math]::Max(1, [int]($height / $blur))
    $small = New-Object System.Drawing.Bitmap $smallWidth, $smallHeight
    $smallGraphics = [System.Drawing.Graphics]::FromImage($small)
    $smallGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $smallGraphics.DrawImage($bitmap, 0, 0, $smallWidth, $smallHeight)
    $smallGraphics.Dispose()
    $blurGraphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $blurGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $blurGraphics.DrawImage($small, 0, 0, $width, $height)
    $blurGraphics.Dispose()
    $small.Dispose()
  }

  $directory = [System.IO.Path]::GetDirectoryName([string]$image.path)
  if ($directory -and -not (Test-Path -LiteralPath $directory)) {
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
  }
  $bitmap.Save([string]$image.path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Output ("image=" + $image.name + " path=" + $image.path)
}

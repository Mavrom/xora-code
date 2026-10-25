param([string]$Out)
# Draws assets/brand/xora-icon.svg geometry directly with System.Drawing (no npm deps).
Add-Type -AssemblyName System.Drawing
$size = 1024
$bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Rounded square: x=4 y=4 w=1016 h=1016 rx=228, stroke 8 (#2a2a2a), fill black.
$x = 4.0; $y = 4.0; $w = 1016.0; $r = 228.0; $d = $r * 2
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($x, $y, $d, $d, 180, 90)
$path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
$path.AddArc($x + $w - $d, $y + $w - $d, $d, $d, 0, 90)
$path.AddArc($x, $y + $w - $d, $d, $d, 90, 90)
$path.CloseFigure()
$g.FillPath([System.Drawing.Brushes]::Black, $path)
$border = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 0x2a, 0x2a, 0x2a)), 8
$g.DrawPath($border, $path)

# Mark: stroke 112, butt caps.
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 112
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Flat
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Flat
$g.DrawLine($pen, 256, 256, 768, 768)
$g.DrawLine($pen, 768, 256, 598.4, 425.6)
$g.DrawLine($pen, 425.6, 598.4, 256, 768)

$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "saved $Out"

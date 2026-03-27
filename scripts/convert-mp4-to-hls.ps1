param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [string]$OutputRoot = ".\\hls-output",

  [int]$SegmentDuration = 6,

  [string]$FfmpegPath = ""
)

function Resolve-FfmpegPath {
  param([string]$PreferredPath)

  if ($PreferredPath -and (Test-Path $PreferredPath)) {
    return (Resolve-Path $PreferredPath).Path
  }

  $candidates = @(
    "C:\Users\pc\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe",
    "C:\Users\pc\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-7.1-full_build\bin\ffmpeg.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  $command = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "ffmpeg is required and was not found in PATH or known install locations."
}

$resolvedInput = Resolve-Path $InputPath -ErrorAction Stop
$inputFile = Get-Item $resolvedInput
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($inputFile.Name)
$outputDir = Join-Path $OutputRoot $baseName
$resolvedFfmpegPath = Resolve-FfmpegPath -PreferredPath $FfmpegPath

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$manifestPath = Join-Path $outputDir "master.m3u8"
$segmentPattern = Join-Path $outputDir "segment_%03d.ts"

$ffmpegArgs = @(
  "-y"
  "-i", $inputFile.FullName
  "-c:v", "libx264"
  "-preset", "veryfast"
  "-crf", "21"
  "-c:a", "aac"
  "-b:a", "128k"
  "-movflags", "+faststart"
  "-f", "hls"
  "-hls_time", "$SegmentDuration"
  "-hls_playlist_type", "vod"
  "-hls_segment_filename", $segmentPattern
  $manifestPath
)

Write-Host "Converting $($inputFile.FullName) to HLS..."
& $resolvedFfmpegPath @ffmpegArgs

if ($LASTEXITCODE -ne 0) {
  throw "ffmpeg failed while building the HLS package."
}

Write-Host ""
Write-Host "HLS package created:"
Write-Host "  Manifest: $manifestPath"
Write-Host "  Segments: $outputDir"
Write-Host ""
Write-Host "Next step:"
Write-Host "  Upload the generated folder to your private video bucket and use the manifest object key in Incentra."

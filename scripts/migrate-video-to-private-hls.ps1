param(
  [Parameter(Mandatory = $true)]
  [string]$VideoId,

  [string]$InputPath = "",
  [string]$SourceUrl = "",
  [string]$ApiBaseUrl = "https://ae0t7v3zf5.execute-api.ap-south-1.amazonaws.com",
  [string]$BucketName = "",
  [string]$HlsPrefix = "",
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

function Resolve-BucketName {
  param([string]$ProvidedBucketName)

  if ($ProvidedBucketName) {
    return $ProvidedBucketName
  }

  Push-Location "$PSScriptRoot\..\terraform"
  try {
    $bucket = (& terraform output -raw videos_bucket_name).Trim()
    if (!$bucket) {
      throw "Terraform output for videos_bucket_name was empty."
    }
    return $bucket
  } finally {
    Pop-Location
  }
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body = $null
  )

  if ($null -eq $Body) {
    return Invoke-RestMethod $Url -Method $Method
  }

  return Invoke-RestMethod $Url -Method $Method -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Compress)
}

function Resolve-LegacyObjectKey {
  param(
    [object]$Video,
    [string]$FallbackSourceUrl
  )

  if ($Video.videoObjectKey) {
    return "$($Video.videoObjectKey)"
  }

  $candidateUrl = if ($FallbackSourceUrl) { $FallbackSourceUrl } else { $Video.videoUrl }
  if (!$candidateUrl) {
    return ""
  }

  try {
    $uri = [System.Uri]$candidateUrl
    $key = $uri.AbsolutePath.TrimStart('/')
    if ($key -match '\.(mp4|mov|mkv|webm)$') {
      return $key
    }
  } catch {
    return ""
  }

  return ""
}

$resolvedApiBaseUrl = $ApiBaseUrl.TrimEnd('/')
$resolvedBucketName = Resolve-BucketName -ProvidedBucketName $BucketName
$resolvedFfmpegPath = Resolve-FfmpegPath -PreferredPath $FfmpegPath
$video = Invoke-JsonRequest -Method GET -Url "$resolvedApiBaseUrl/videos/$VideoId"
$legacyObjectKey = Resolve-LegacyObjectKey -Video $video -FallbackSourceUrl $SourceUrl

$workingRoot = Join-Path $env:TEMP "incentra-hls-$VideoId"
if (Test-Path $workingRoot) {
  Remove-Item -Recurse -Force $workingRoot
}
New-Item -ItemType Directory -Force -Path $workingRoot | Out-Null

$resolvedInputPath = $InputPath
if (!$resolvedInputPath) {
  $downloadSource = if ($SourceUrl) { $SourceUrl } else { $video.videoUrl }
  if (!$downloadSource) {
    throw "No InputPath or download source is available for video $VideoId."
  }

  $resolvedInputPath = Join-Path $workingRoot "source.mp4"
  Write-Host "Downloading source video from $downloadSource"
  curl.exe -L $downloadSource --output $resolvedInputPath
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to download the source MP4."
  }
}

$resolvedInputPath = (Resolve-Path $resolvedInputPath).Path
$manifestPrefix = if ($HlsPrefix) {
  $HlsPrefix.Trim('/')
} else {
  "hls/$((Get-Date).ToString('yyyy-MM-dd'))/$VideoId"
}

$outputDir = Join-Path $workingRoot "hls"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$manifestPath = Join-Path $outputDir "master.m3u8"
$segmentPattern = Join-Path $outputDir "segment_%03d.ts"

$ffmpegArgs = @(
  "-y"
  "-i", $resolvedInputPath
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

Write-Host "Converting $resolvedInputPath to HLS..."
& $resolvedFfmpegPath @ffmpegArgs
if ($LASTEXITCODE -ne 0) {
  throw "ffmpeg failed during HLS packaging."
}

$s3Destination = "s3://$resolvedBucketName/$manifestPrefix/"
Write-Host "Uploading HLS package to $s3Destination"
aws s3 cp $outputDir $s3Destination --recursive
if ($LASTEXITCODE -ne 0) {
  throw "Failed to upload the HLS package to S3."
}

$patch = @{
  hlsManifestKey = "$manifestPrefix/master.m3u8"
  playbackType   = "hls"
  sourceFormat   = "hls"
  videoUrl       = $null
  videoObjectKey = $null
  streamUrl      = $null
}

$updatedVideo = Invoke-JsonRequest -Method PATCH -Url "$resolvedApiBaseUrl/videos/$VideoId" -Body $patch

if ($legacyObjectKey) {
  $legacyS3Path = "s3://$resolvedBucketName/$legacyObjectKey"
  Write-Host "Removing legacy source object $legacyS3Path"
  aws s3 rm $legacyS3Path
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to remove the legacy source object from S3."
  }
}

Write-Host ""
Write-Host "Migration complete."
Write-Host "  Video ID: $VideoId"
Write-Host "  Bucket: $resolvedBucketName"
Write-Host "  Manifest key: $($patch.hlsManifestKey)"
Write-Host "  Updated playback type: $($updatedVideo.playbackType)"
if ($legacyObjectKey) {
  Write-Host "  Removed legacy source: $legacyObjectKey"
}

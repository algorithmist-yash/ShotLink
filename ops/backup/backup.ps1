param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($env:MONGO_URI)) {
  throw "MONGO_URI must be provided through the environment."
}

$mongodump = Get-Command mongodump -ErrorAction Stop
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$archivePath = Join-Path $resolvedOutput "shotlink-$timestamp.archive.gz"

& $mongodump.Source "--uri=$($env:MONGO_URI)" "--archive=$archivePath" --gzip
if ($LASTEXITCODE -ne 0) { throw "mongodump failed with exit code $LASTEXITCODE" }

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
$manifest = [ordered]@{
  archive = [System.IO.Path]::GetFileName($archivePath)
  createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  sha256 = $hash
  sizeBytes = (Get-Item -LiteralPath $archivePath).Length
}
$manifestPath = "$archivePath.manifest.json"
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM
Write-Output "Backup archive: $archivePath"
Write-Output "Manifest: $manifestPath"

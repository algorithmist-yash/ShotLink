param(
  [Parameter(Mandatory = $true)]
  [string]$BackupArchive,
  [Parameter(Mandatory = $true)]
  [string]$TargetMongoUri
)

$ErrorActionPreference = "Stop"
if ($env:SHOTLINK_RESTORE_CONFIRM -ne "ISOLATED_NON_PRODUCTION") {
  throw "Set SHOTLINK_RESTORE_CONFIRM=ISOLATED_NON_PRODUCTION after verifying the target is disposable."
}
if ([string]::IsNullOrWhiteSpace($TargetMongoUri)) { throw "TargetMongoUri is required." }
if ($TargetMongoUri -eq $env:MONGO_URI) { throw "The restore target must not equal the configured source MONGO_URI." }

$archivePath = [System.IO.Path]::GetFullPath($BackupArchive)
if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) { throw "Backup archive does not exist." }
$manifestPath = "$archivePath.manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Backup manifest does not exist." }

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
if ($actualHash -ne $manifest.sha256) { throw "Backup checksum does not match the manifest." }

$mongorestore = Get-Command mongorestore -ErrorAction Stop
$startedAt = Get-Date
& $mongorestore.Source "--uri=$TargetMongoUri" "--archive=$archivePath" --gzip --drop
if ($LASTEXITCODE -ne 0) { throw "mongorestore failed with exit code $LASTEXITCODE" }

$duration = (Get-Date) - $startedAt
Write-Output "Restore completed into the isolated target in $([math]::Round($duration.TotalSeconds, 2)) seconds."
Write-Output "Run the recovery verification checklist in DISASTER_RECOVERY.md before recording the drill as successful."

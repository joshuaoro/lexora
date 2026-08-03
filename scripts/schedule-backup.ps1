<#
.SYNOPSIS
  Register a daily LEXORA database backup as a Windows scheduled task.

.DESCRIPTION
  Supabase's free tier takes no automatic backups, and reading data collected
  from children cannot be re-gathered. During the study the database should be
  backed up without anyone having to remember to do it.

  The backup runs on this machine and writes to this machine. That is a
  deliberate choice: the file contains children's voice recordings, so it must
  not go anywhere it could be read by others. In particular it must NOT be
  uploaded as a GitHub Actions artifact — artifacts of a public repository can
  be downloaded by anyone.

  Backups still need a second copy somewhere off this laptop. Point -BackupDir
  at a synced folder (OneDrive, Google Drive) or copy the folder to an
  encrypted external drive regularly. A drive failure would otherwise take the
  study data with it.

.EXAMPLE
  # From the project root, in a normal (non-admin) PowerShell:
  .\scripts\schedule-backup.ps1

.EXAMPLE
  # Back up at 19:30 into a OneDrive folder, keeping 30 files:
  .\scripts\schedule-backup.ps1 -At 19:30 -BackupDir "$env:OneDrive\lexora-backups" -Keep 30

.EXAMPLE
  # Remove the scheduled task again:
  .\scripts\schedule-backup.ps1 -Remove
#>
[CmdletBinding()]
param(
  [string]$At = "20:00",
  [string]$BackupDir = "",
  [int]$Keep = 14,
  [string]$TaskName = "LEXORA daily backup",
  [switch]$Remove
)

$ErrorActionPreference = "Stop"

if ($Remove) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'."
  } else {
    Write-Host "No scheduled task named '$TaskName'."
  }
  return
}

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $projectRoot "package.json"))) {
  throw "Run this from the LEXORA project (package.json not found at $projectRoot)."
}
if (-not (Test-Path (Join-Path $projectRoot ".env"))) {
  throw "No .env found. The backup needs DIRECT_URL to reach the database."
}

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) { $npm = (Get-Command npm -ErrorAction SilentlyContinue).Source }
if (-not $npm) { throw "npm was not found on PATH." }

# Build the command. An explicit --out keeps the timestamped name this script's
# pruning expects, while letting the files live outside the project.
$argList = "run backup --"
if ($BackupDir) {
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $argList += " --out `"$BackupDir\lexora-`$(Get-Date -Format yyyy-MM-ddTHH-mm-ss).json.gz`""
}
$argList += " --keep $Keep"

# Wrapped in cmd so the working directory is right and output is captured for
# later inspection — a scheduled task that fails silently is worthless.
$logPath = Join-Path $projectRoot "backups\schedule.log"
New-Item -ItemType Directory -Force -Path (Split-Path $logPath) | Out-Null

$action = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c `"`"$npm`" $argList >> `"$logPath`" 2>&1`"" `
  -WorkingDirectory $projectRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $At

# Run whether or not the laptop is on mains, and catch up after it was asleep —
# a study laptop is closed most of the day, and a backup that only fires when
# plugged in at exactly 20:00 will mostly never fire.
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Backs up the LEXORA Supabase database to a local compressed file." `
  -Force | Out-Null

Write-Host "Scheduled '$TaskName' daily at $At."
Write-Host "  project : $projectRoot"
Write-Host "  output  : $(if ($BackupDir) { $BackupDir } else { Join-Path $projectRoot 'backups' })"
Write-Host "  keeping : $Keep most recent"
Write-Host "  log     : $logPath"
Write-Host ""
Write-Host "Run it once now to confirm it works:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "Then check the log, and rehearse a restore before you trust it:"
Write-Host "  npm run restore -- <newest file> --verify"
Write-Host ""
Write-Host "Keep a second copy off this laptop. The file contains children's voice"
Write-Host "recordings, so do not put it anywhere publicly readable."

param(
  [switch]$Apply,
  [string]$ProjectId = "blackvision-27f1c",
  [string]$DatabaseId = "(default)",
  [string]$Location = "nam5",
  [string]$BackupRetention = "14d"
)

$ErrorActionPreference = "Stop"

function Invoke-FirebaseJson {
  param([string[]]$Arguments)

  $output = & firebase @Arguments --project $ProjectId --non-interactive --json
  if ($LASTEXITCODE -ne 0) {
    throw "Firebase command failed: firebase $($Arguments -join ' ')"
  }
  return ($output | Out-String | ConvertFrom-Json)
}

function Get-DatabaseState {
  return (Invoke-FirebaseJson @("firestore:databases:get", $DatabaseId)).result
}

function Get-ResourceCount {
  param($Value)

  if ($null -eq $Value) { return 0 }
  if ($Value -is [System.Management.Automation.PSCustomObject] -and @($Value.PSObject.Properties).Count -eq 0) {
    return 0
  }
  return @($Value).Count
}

$before = Get-DatabaseState

if ($Apply) {
  if ($before.deleteProtectionState -ne "DELETE_PROTECTION_ENABLED") {
    Invoke-FirebaseJson @(
      "firestore:databases:update",
      $DatabaseId,
      "--delete-protection",
      "ENABLED"
    ) | Out-Null
  }

  if ($before.pointInTimeRecoveryEnablement -ne "POINT_IN_TIME_RECOVERY_ENABLED") {
    Invoke-FirebaseJson @(
      "firestore:databases:update",
      $DatabaseId,
      "--point-in-time-recovery",
      "ENABLED"
    ) | Out-Null
  }

  $schedules = (Invoke-FirebaseJson @(
    "firestore:backups:schedules:list",
    "--database",
    $DatabaseId
  )).result

  if ((Get-ResourceCount $schedules) -eq 0) {
    Invoke-FirebaseJson @(
      "firestore:backups:schedules:create",
      "--database",
      $DatabaseId,
      "--retention",
      $BackupRetention,
      "--recurrence",
      "DAILY"
    ) | Out-Null
  }
}

$after = Get-DatabaseState
$scheduleState = (Invoke-FirebaseJson @(
  "firestore:backups:schedules:list",
  "--database",
  $DatabaseId
)).result
$backupState = (Invoke-FirebaseJson @(
  "firestore:backups:list",
  "--location",
  $Location
)).result

[pscustomobject]@{
  project = $ProjectId
  database = $DatabaseId
  location = $after.locationId
  delete_protection = $after.deleteProtectionState
  pitr = $after.pointInTimeRecoveryEnablement
  retention = $after.versionRetentionPeriod
  backup_schedules = Get-ResourceCount $scheduleState
  backups_available = Get-ResourceCount $backupState
  mode = if ($Apply) { "apply" } else { "status" }
} | ConvertTo-Json -Depth 5

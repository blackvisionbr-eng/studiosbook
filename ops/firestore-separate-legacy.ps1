param(
  [switch]$Apply,
  [string]$ProjectId = "blackvision-27f1c",
  [string]$SourceDatabase = "(default)",
  [string]$ArchiveDatabase = "blackvision-archive",
  [string]$Location = "nam5"
)

$ErrorActionPreference = "Stop"
$LegacyCollections = @("analytics", "events", "site", "transactions")

if ($SourceDatabase -ne "(default)") {
  throw "Guardrail: the source database must be (default)."
}

if ($ArchiveDatabase -ne "blackvision-archive") {
  throw "Guardrail: the archive database must be blackvision-archive."
}

function Get-AccessHeaders {
  $login = & firebase login:list --json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $login.result[0].tokens.access_token) {
    throw "Unable to obtain the Firebase CLI access token."
  }

  return @{
    Authorization = "Bearer $($login.result[0].tokens.access_token)"
    "x-goog-user-project" = $ProjectId
  }
}

function Get-DatabaseList {
  $response = & firebase firestore:databases:list `
    --project $ProjectId `
    --non-interactive `
    --json | ConvertFrom-Json

  if ($LASTEXITCODE -ne 0) {
    throw "Unable to list Firestore databases."
  }

  return @($response.result)
}

function Get-CollectionDocuments {
  param(
    [hashtable]$Headers,
    [string]$DatabaseId,
    [string]$CollectionId
  )

  $documents = @()
  $pageToken = $null

  do {
    $uri = "https://firestore.googleapis.com/v1/projects/{0}/databases/{1}/documents/{2}?pageSize=300" -f `
      $ProjectId, $DatabaseId, $CollectionId
    if ($pageToken) {
      $uri += "&pageToken=$([uri]::EscapeDataString($pageToken))"
    }

    $page = Invoke-RestMethod -Headers $Headers -Uri $uri
    $documents += @($page.documents)
    $pageToken = $page.nextPageToken
  } while ($pageToken)

  return @($documents | Where-Object { $null -ne $_ })
}

function Copy-Collection {
  param(
    [hashtable]$Headers,
    [string]$CollectionId
  )

  $sourceDocuments = @(
    Get-CollectionDocuments `
      -Headers $Headers `
      -DatabaseId $SourceDatabase `
      -CollectionId $CollectionId
  )

  for ($offset = 0; $offset -lt $sourceDocuments.Count; $offset += 200) {
    $end = [Math]::Min($offset + 199, $sourceDocuments.Count - 1)
    $writes = @()

    foreach ($document in @($sourceDocuments[$offset..$end])) {
      $targetName = $document.name.Replace(
        "/databases/$SourceDatabase/",
        "/databases/$ArchiveDatabase/"
      )
      $writes += @{
        update = @{
          name = $targetName
          fields = $document.fields
        }
      }
    }

    if ($writes.Count -eq 0) {
      throw "No writes were generated for collection $CollectionId."
    }

    $body = @{ writes = $writes } | ConvertTo-Json -Depth 100
    $uri = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/$ArchiveDatabase/documents:commit"
    Invoke-RestMethod `
      -Method Post `
      -Headers $Headers `
      -ContentType "application/json" `
      -Body $body `
      -Uri $uri | Out-Null
  }

  return $sourceDocuments.Count
}

function Get-CollectionCount {
  param(
    [hashtable]$Headers,
    [string]$DatabaseId,
    [string]$CollectionId
  )

  $body = @{
    structuredAggregationQuery = @{
      aggregations = @(@{ alias = "total"; count = @{} })
      structuredQuery = @{ from = @(@{ collectionId = $CollectionId }) }
    }
  } | ConvertTo-Json -Depth 10

  $uri = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/$DatabaseId/documents:runAggregationQuery"
  $result = Invoke-RestMethod `
    -Method Post `
    -Headers $Headers `
    -ContentType "application/json" `
    -Body $body `
    -Uri $uri

  return [int64]$result[0].result.aggregateFields.total.integerValue
}

$headers = Get-AccessHeaders
$databases = Get-DatabaseList
$archiveExists = @(
  $databases | Where-Object {
    $_.name -eq "projects/$ProjectId/databases/$ArchiveDatabase"
  }
).Count -gt 0

if ($Apply -and -not $archiveExists) {
  & firebase firestore:databases:create $ArchiveDatabase `
    --location $Location `
    --delete-protection ENABLED `
    --point-in-time-recovery DISABLED `
    --project $ProjectId `
    --non-interactive `
    --json | Out-Null

  if ($LASTEXITCODE -ne 0) {
    throw "Unable to create the BlackVision archive database."
  }

  $archiveExists = $true
}

if (-not $archiveExists) {
  [pscustomobject]@{
    project = $ProjectId
    source = $SourceDatabase
    archive = $ArchiveDatabase
    archive_exists = $false
    mode = "status"
  } | ConvertTo-Json -Depth 5
  exit 0
}

$before = @{}
foreach ($collection in $LegacyCollections) {
  $before[$collection] = Get-CollectionCount `
    -Headers $headers `
    -DatabaseId $SourceDatabase `
    -CollectionId $collection
}

if ($Apply) {
  foreach ($collection in $LegacyCollections) {
    $copied = Copy-Collection -Headers $headers -CollectionId $collection
    $archiveCount = Get-CollectionCount `
      -Headers $headers `
      -DatabaseId $ArchiveDatabase `
      -CollectionId $collection

    if ($copied -ne $before[$collection] -or $archiveCount -lt $before[$collection]) {
      throw "Validation failed for collection $collection. Source data was not deleted."
    }
  }

  foreach ($collection in $LegacyCollections) {
    if ($before[$collection] -eq 0) {
      continue
    }

    & firebase firestore:delete $collection `
      --database $SourceDatabase `
      --recursive `
      --force `
      --project $ProjectId | Out-Null

    if ($LASTEXITCODE -ne 0) {
      throw "Unable to remove legacy collection $collection from the source database."
    }
  }
}

$result = foreach ($collection in $LegacyCollections) {
  [pscustomobject]@{
    collection = $collection
    source_before = $before[$collection]
    source_after = Get-CollectionCount `
      -Headers $headers `
      -DatabaseId $SourceDatabase `
      -CollectionId $collection
    archive = Get-CollectionCount `
      -Headers $headers `
      -DatabaseId $ArchiveDatabase `
      -CollectionId $collection
  }
}

[pscustomobject]@{
  project = $ProjectId
  source = $SourceDatabase
  archive = $ArchiveDatabase
  archive_delete_protection = (
    (Get-DatabaseList | Where-Object {
      $_.name -eq "projects/$ProjectId/databases/$ArchiveDatabase"
    }).deleteProtectionState
  )
  collections = @($result)
  mode = if ($Apply) { "apply" } else { "status" }
} | ConvertTo-Json -Depth 8

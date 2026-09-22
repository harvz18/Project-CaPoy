param(
  [string]$ModelRoot = 'D:\Sentiment Training\multivent-sentiment',
  [string]$SentimentApiUrl = ''
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv {
  param([string]$Path)

  $values = @{}
  if (Test-Path -LiteralPath $Path) {
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
      if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
      $parts = $line -split '=', 2
      $values[$parts[0].Trim()] = $parts[1].Trim()
    }
  }
  return $values
}

function Set-DotEnvValues {
  param(
    [string]$Path,
    [hashtable]$Updates
  )

  $lines = [Collections.Generic.List[string]]::new()
  if (Test-Path -LiteralPath $Path) {
    $lines.AddRange([string[]][IO.File]::ReadAllLines($Path))
  }

  foreach ($key in $Updates.Keys) {
    $replacement = "$key=$($Updates[$key])"
    $replaced = $false
    for ($index = 0; $index -lt $lines.Count; $index++) {
      if ($lines[$index] -match "^\s*$([regex]::Escape($key))\s*=") {
        $lines[$index] = $replacement
        $replaced = $true
        break
      }
    }
    if (-not $replaced) { $lines.Add($replacement) }
  }

  $directory = Split-Path -Parent $Path
  [IO.Directory]::CreateDirectory($directory) | Out-Null
  $temporaryPath = Join-Path $directory ('.env-' + [guid]::NewGuid().ToString('N') + '.tmp')
  try {
    [IO.File]::WriteAllLines($temporaryPath, $lines, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
  } finally {
    if (Test-Path -LiteralPath $temporaryPath) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
  }
}

$resolvedModelRoot = (Resolve-Path -LiteralPath $ModelRoot).Path
$modelEnvPath = Join-Path $resolvedModelRoot '.env'
$appRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$supabaseEnvPath = Join-Path $appRoot 'supabase\.env'
$modelValues = Read-DotEnv -Path $modelEnvPath

if ([string]::IsNullOrWhiteSpace($modelValues['OPENAI_API_KEY'])) {
  throw 'OPENAI_API_KEY is missing from the sentiment model .env file.'
}
if ([string]::IsNullOrWhiteSpace($modelValues['OPENAI_MODEL'])) {
  throw 'OPENAI_MODEL is missing from the sentiment model .env file.'
}

$analysisApiKey = $modelValues['ANALYSIS_API_KEY']
if ([string]::IsNullOrWhiteSpace($analysisApiKey)) {
  $keyBytes = [byte[]]::new(32)
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($keyBytes)
  } finally {
    $generator.Dispose()
  }
  $analysisApiKey = ([BitConverter]::ToString($keyBytes) -replace '-', '').ToLowerInvariant()
}

Set-DotEnvValues -Path $modelEnvPath -Updates @{
  AI_PROVIDER = 'openai'
  ANALYSIS_API_KEY = $analysisApiKey
  EMBEDDING_LOCAL_FILES_ONLY = 'true'
  ENABLE_ANALYSIS_LOGGING = 'false'
}

$normalizedUrl = $SentimentApiUrl.Trim().TrimEnd('/')
Set-DotEnvValues -Path $supabaseEnvPath -Updates @{
  SENTIMENT_API_KEY = $analysisApiKey
  SENTIMENT_API_URL = $normalizedUrl
}

Write-Output 'Sentiment integration secrets configured.'
Write-Output "OpenAI model: $($modelValues['OPENAI_MODEL'])"
Write-Output 'Provider: openai'
Write-Output 'Analysis logging: disabled'
Write-Output 'The shared secret was written without being displayed.'
if ([string]::IsNullOrWhiteSpace($normalizedUrl)) {
  Write-Output 'SENTIMENT_API_URL is awaiting the public HTTPS model-service URL.'
} else {
  Write-Output "Sentiment API URL: $normalizedUrl"
}

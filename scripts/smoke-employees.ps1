$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

try {
  $csrfResp = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/auth/csrf" -WebSession $session -TimeoutSec 10
  $csrfObj = $csrfResp.Content | ConvertFrom-Json
  $csrf = $csrfObj.csrfToken
  if (-not $csrf) { throw 'No CSRF token received' }
  Write-Output ("CSRF_OK=" + [bool]$csrf)

  $loginBody = "csrfToken=$([uri]::EscapeDataString($csrf))&email=$([uri]::EscapeDataString('admin1@test.nl'))&password=$([uri]::EscapeDataString('admin123'))&rememberMe=false&json=true&callbackUrl=$([uri]::EscapeDataString($base + '/dashboard'))"

  try {
    Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$base/api/auth/callback/credentials?json=true" -ContentType 'application/x-www-form-urlencoded' -Body $loginBody -WebSession $session -MaximumRedirection 0 -TimeoutSec 10 | Out-Null
  } catch {
    if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 302) {
      # Expected redirect after successful credentials callback
    } else {
      throw
    }
  }

  $sessionResp = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/auth/session" -WebSession $session -TimeoutSec 10
  $sessionObj = $sessionResp.Content | ConvertFrom-Json
  if (-not $sessionObj.user -or $sessionObj.user.role -ne 'ADMIN') { throw 'Admin session not established' }
  Write-Output ("SESSION_OK=" + $sessionObj.user.email + ":" + $sessionObj.user.role)

  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $email = "smoke.$stamp@test.nl"

  $createPayload = @{
    name = 'Smoke Test User'
    email = $email
    phone = '0612345678'
    role = 'EMPLOYEE'
    active = $true
    password = 'smoke123'
    functieIds = @()
    kwalificatieIds = @()
  } | ConvertTo-Json -Depth 6

  $createResp = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$base/api/employees" -ContentType 'application/json' -Body $createPayload -WebSession $session -TimeoutSec 20
  $createObj = $createResp.Content | ConvertFrom-Json
  if ([int]$createResp.StatusCode -ne 201 -or -not $createObj.id) { throw 'Create failed' }
  $id = $createObj.id
  Write-Output ("CREATE_OK id=" + $id)

  $updatePayload = @{ name = 'Smoke Updated User'; phone = '0699999999'; active = $true } | ConvertTo-Json
  $updateResp = Invoke-WebRequest -UseBasicParsing -Method Put -Uri "$base/api/employees/$id" -ContentType 'application/json' -Body $updatePayload -WebSession $session -TimeoutSec 20
  $updateObj = $updateResp.Content | ConvertFrom-Json
  if ([int]$updateResp.StatusCode -ne 200 -or $updateObj.name -ne 'Smoke Updated User') { throw 'Update failed' }
  Write-Output ("UPDATE_OK name=" + $updateObj.name)

  $deleteResp = Invoke-WebRequest -UseBasicParsing -Method Delete -Uri "$base/api/employees/$id" -WebSession $session -TimeoutSec 20
  $deleteObj = $deleteResp.Content | ConvertFrom-Json
  if ([int]$deleteResp.StatusCode -ne 200 -or -not $deleteObj.success) { throw 'Delete failed' }
  Write-Output ("DELETE_OK success=" + $deleteObj.success)

  Write-Output 'SMOKE_OK'
}
catch {
  Write-Output ("SMOKE_FAIL=" + $_.Exception.Message)
  exit 1
}

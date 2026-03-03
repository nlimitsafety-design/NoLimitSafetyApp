$token = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3MzgwOTMwNDgsImlkIjoiMGIwZjA2M2UtNDg4ZC00N2Q0LWI3ZjctNjVkYTc1ZmM3OTYxIn0.D9U98stVhsGncQHiv3XYMkuS-ZFqJlJgSdxRPNGxfbjnTJSMGqhr3T4wod1ypzglQPe3_MdQ5L9v0fNR0TZoAg"
$url = "https://securityapp-qeeuz.aws-eu-west-1.turso.io"
$h = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# Create tables
$sqls = @(
  "CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY NOT NULL, name TEXT, isGroup INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL DEFAULT (datetime('now')), updatedAt TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS conversation_members (id TEXT PRIMARY KEY NOT NULL, conversationId TEXT NOT NULL, userId TEXT NOT NULL, lastReadAt TEXT NOT NULL DEFAULT (datetime('now')), createdAt TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE, FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE)",
  "CREATE UNIQUE INDEX IF NOT EXISTS conversation_members_conversationId_userId_key ON conversation_members(conversationId, userId)",
  "CREATE INDEX IF NOT EXISTS conversation_members_userId_idx ON conversation_members(userId)",
  "CREATE INDEX IF NOT EXISTS conversation_members_conversationId_idx ON conversation_members(conversationId)",
  "CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY NOT NULL, conversationId TEXT NOT NULL, senderId TEXT NOT NULL, content TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE, FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE)",
  "CREATE INDEX IF NOT EXISTS messages_conversationId_createdAt_idx ON messages(conversationId, createdAt)",
  "CREATE INDEX IF NOT EXISTS messages_senderId_idx ON messages(senderId)"
)

foreach ($s in $sqls) {
  $body = (@{ statements = @(@{ q = $s }) } | ConvertTo-Json -Depth 5)
  try {
    $r = Invoke-RestMethod -Uri "$url/v2/pipeline" -Method POST -Headers $h -Body $body
    if ($r.results[0].type -eq 'ok') { Write-Host "OK: $($s.Substring(0, 50))..." }
    else { Write-Host "ERR: $($r.results[0].error.message)" }
  } catch {
    Write-Host "EXCEPTION: $($_.Exception.Message)"
  }
}

# Verify tables
Write-Host "`n--- Tables in DB ---"
$body = '{"statements":[{"q":"SELECT name FROM sqlite_master WHERE type=''table'' ORDER BY name"}]}'
$r = Invoke-RestMethod -Uri "$url/v2/pipeline" -Method POST -Headers $h -Body $body
$r.results[0].response.result.rows | ForEach-Object { Write-Host $_[0].value }

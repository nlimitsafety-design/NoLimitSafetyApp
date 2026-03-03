const { createClient } = require('@libsql/client');

const client = createClient({
  url: 'libsql://securityapp-qeeuz.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIzMDAwNTEsImlkIjoiMDE5Y2E1NGYtODcwMS03MTI3LWE1ZTUtZGE3ZWQzOTA1ZjVkIiwicmlkIjoiODY4MjljMTMtYjQ3NC00ZDgzLWIyZDAtNTE4ZTE1YzNmYTliIn0.4CILWqvSUDF4ALZ69Aoa5dRMIZrgYgPpuJN4KuUkceEMUXGSw6Rh94xQp_XYZsBN4DjB5GMcp9_U6X_rQ5khDg',
});

async function migrate() {
  const sqls = [
    `CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT,
      isGroup INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS conversation_members (
      id TEXT PRIMARY KEY NOT NULL,
      conversationId TEXT NOT NULL,
      userId TEXT NOT NULL,
      lastReadAt TEXT NOT NULL DEFAULT (datetime('now')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS conversation_members_conversationId_userId_key ON conversation_members(conversationId, userId)`,
    `CREATE INDEX IF NOT EXISTS conversation_members_userId_idx ON conversation_members(userId)`,
    `CREATE INDEX IF NOT EXISTS conversation_members_conversationId_idx ON conversation_members(conversationId)`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversationId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS messages_conversationId_createdAt_idx ON messages(conversationId, createdAt)`,
    `CREATE INDEX IF NOT EXISTS messages_senderId_idx ON messages(senderId)`,
  ];

  for (const sql of sqls) {
    try {
      await client.execute(sql);
      console.log('OK:', sql.substring(0, 50) + '...');
    } catch (e) {
      console.error('ERR:', e.message);
    }
  }

  // Verify
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('\n--- Tables ---');
  tables.rows.forEach(r => console.log(r.name));
}

migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

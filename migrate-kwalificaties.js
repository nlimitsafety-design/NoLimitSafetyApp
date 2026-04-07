const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://securityapp-qeeuz.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIzMDAwNTEsImlkIjoiMDE5Y2E1NGYtODcwMS03MTI3LWE1ZTUtZGE3ZWQzOTA1ZjVkIiwicmlkIjoiODY4MjljMTMtYjQ3NC00ZDgzLWIyZDAtNTE4ZTE1YzNmYTliIn0.4CILWqvSUDF4ALZ69Aoa5dRMIZrgYgPpuJN4KuUkceEMUXGSw6Rh94xQp_XYZsBN4DjB5GMcp9_U6X_rQ5khDg'
});

async function migrate() {
  // 1. Create kwalificaties table
  await c.execute(`CREATE TABLE IF NOT EXISTS kwalificaties (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('Created kwalificaties table');

  // 2. Create user_kwalificaties join table
  await c.execute(`CREATE TABLE IF NOT EXISTS user_kwalificaties (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    kwalificatieId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (kwalificatieId) REFERENCES kwalificaties(id) ON DELETE CASCADE
  )`);
  await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS user_kwalificaties_userId_kwalificatieId_key ON user_kwalificaties(userId, kwalificatieId)');
  await c.execute('CREATE INDEX IF NOT EXISTS user_kwalificaties_userId_idx ON user_kwalificaties(userId)');
  await c.execute('CREATE INDEX IF NOT EXISTS user_kwalificaties_kwalificatieId_idx ON user_kwalificaties(kwalificatieId)');
  console.log('Created user_kwalificaties table + indexes');

  // 3. Create user_functies join table
  await c.execute(`CREATE TABLE IF NOT EXISTS user_functies (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    functieId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (functieId) REFERENCES functies(id) ON DELETE CASCADE
  )`);
  await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS user_functies_userId_functieId_key ON user_functies(userId, functieId)');
  await c.execute('CREATE INDEX IF NOT EXISTS user_functies_userId_idx ON user_functies(userId)');
  await c.execute('CREATE INDEX IF NOT EXISTS user_functies_functieId_idx ON user_functies(functieId)');
  console.log('Created user_functies table + indexes');

  // 4. Migrate existing functieId data to user_functies
  const users = await c.execute('SELECT id, functieId FROM users WHERE functieId IS NOT NULL');
  let migrated = 0;
  for (const u of users.rows) {
    const cuid = 'mig' + Math.random().toString(36).slice(2, 24);
    await c.execute({
      sql: 'INSERT OR IGNORE INTO user_functies (id, userId, functieId) VALUES (?, ?, ?)',
      args: [cuid, u.id, u.functieId]
    });
    migrated++;
  }
  console.log('Migrated', migrated, 'user functies');

  // Verify
  const uf = await c.execute('SELECT COUNT(*) as cnt FROM user_functies');
  console.log('user_functies count:', uf.rows[0].cnt);
  const uk = await c.execute('SELECT COUNT(*) as cnt FROM user_kwalificaties');
  console.log('user_kwalificaties count:', uk.rows[0].cnt);
  
  console.log('Migration complete!');
}

migrate().catch(e => console.error(e));

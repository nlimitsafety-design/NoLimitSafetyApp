const path = require('path');
const fs = require('fs');

// Parse .env manually
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // Create opdrachtgevers table
  await client.execute(`CREATE TABLE IF NOT EXISTS opdrachtgevers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contactPerson TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('Table opdrachtgevers created/verified');

  // Add opdrachtgeverId column to shifts
  try {
    await client.execute('ALTER TABLE shifts ADD COLUMN opdrachtgeverId TEXT REFERENCES opdrachtgevers(id) ON DELETE SET NULL');
    console.log('Column opdrachtgeverId added to shifts');
  } catch (e) {
    if (e.message.includes('duplicate column') || e.message.includes('already exists')) {
      console.log('Column opdrachtgeverId already exists');
    } else {
      throw e;
    }
  }

  console.log('Migration complete');
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});

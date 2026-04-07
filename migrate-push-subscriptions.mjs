import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://securityapp-qeeuz.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIzMDMxMzMsImlkIjoiMDE5Y2E1NGYtODcwMS03MTI3LWE1ZTUtZGE3ZWQzOTA1ZjVkIiwicmlkIjoiODY4MjljMTMtYjQ3NC00ZDgzLWIyZDAtNTE4ZTE1YzNmYTliIn0.7od1ypzgCBO-DYtrnMYsjnDwplD74Q-UUhK2BUK1n5TdveW-zSxe7gIkUkn93fPnW_VCyeEUQtC27AVii4d9Dg',
});

async function migrate() {
  console.log('Creating push_subscriptions table...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('Table created.');

  await client.execute('CREATE INDEX IF NOT EXISTS idx_push_subscriptions_userId ON push_subscriptions(userId)');
  console.log('Index created.');

  console.log('Done!');
}

migrate().catch(console.error);

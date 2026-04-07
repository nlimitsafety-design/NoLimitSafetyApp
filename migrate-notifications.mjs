/**
 * Migration script: Create the "notifications" table.
 *
 * Run with:  node migrate-notifications.mjs
 */

import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://securityapp-qeeuz.aws-eu-west-1.turso.io',
  authToken:
    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIzMDMxMzMsImlkIjoiMDE5Y2E1NGYtODcwMS03MTI3LWE1ZTUtZGE3ZWQzOTA1ZjVkIiwicmlkIjoiODY4MjljMTMtYjQ3NC00ZDgzLWIyZDAtNTE4ZTE1YzNmYTliIn0.7od1ypzgCBO-DYtrnMYsjnDwplD74Q-UUhK2BUK1n5TdveW-zSxe7gIkUkn93fPnW_VCyeEUQtC27AVii4d9Dg',
});

async function main() {
  console.log('Creating notifications table...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id        TEXT PRIMARY KEY NOT NULL,
      userId    TEXT NOT NULL,
      type      TEXT NOT NULL,
      title     TEXT NOT NULL,
      message   TEXT NOT NULL,
      read      INTEGER NOT NULL DEFAULT 0,
      shiftId   TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  console.log('Table created.');

  // Create indexes
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(userId, read)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(userId, createdAt)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId)`);

  console.log('Indexes created.');
  console.log('Done!');
}

main().catch(console.error);

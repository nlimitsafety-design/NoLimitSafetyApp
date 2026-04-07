/**
 * Migration script: Create the "toeslagen" table and seed default surcharge rules.
 *
 * Run with:  node migrate-toeslagen.mjs
 */

import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://securityapp-qeeuz.aws-eu-west-1.turso.io',
  authToken:
    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIzMDMxMzMsImlkIjoiMDE5Y2E1NGYtODcwMS03MTI3LWE1ZTUtZGE3ZWQzOTA1ZjVkIiwicmlkIjoiODY4MjljMTMtYjQ3NC00ZDgzLWIyZDAtNTE4ZTE1YzNmYTliIn0.7od1ypzgCBO-DYtrnMYsjnDwplD74Q-UUhK2BUK1n5TdveW-zSxe7gIkUkn93fPnW_VCyeEUQtC27AVii4d9Dg',
});

async function main() {
  console.log('Creating toeslagen table...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS toeslagen (
      id         TEXT PRIMARY KEY NOT NULL,
      name       TEXT NOT NULL UNIQUE,
      type       TEXT NOT NULL,
      startTime  TEXT,
      endTime    TEXT,
      days       TEXT,
      percentage REAL NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      sortOrder  INTEGER NOT NULL DEFAULT 0,
      createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Table created.');

  // Seed default surcharge rules (Dutch security industry standards)
  const defaults = [
    {
      id: 'toeslag_avond',
      name: 'Avondtoeslag',
      type: 'TIME_BASED',
      startTime: '20:00',
      endTime: '00:00',
      days: null,
      percentage: 130,
      sortOrder: 1,
    },
    {
      id: 'toeslag_nacht',
      name: 'Nachttoeslag',
      type: 'TIME_BASED',
      startTime: '00:00',
      endTime: '06:00',
      days: null,
      percentage: 140,
      sortOrder: 2,
    },
    {
      id: 'toeslag_zaterdag',
      name: 'Zaterdagtoeslag',
      type: 'DAY_BASED',
      startTime: null,
      endTime: null,
      days: '6',
      percentage: 150,
      sortOrder: 3,
    },
    {
      id: 'toeslag_zondag',
      name: 'Zondagtoeslag',
      type: 'DAY_BASED',
      startTime: null,
      endTime: null,
      days: '7',
      percentage: 200,
      sortOrder: 4,
    },
  ];

  for (const d of defaults) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO toeslagen (id, name, type, startTime, endTime, days, percentage, active, sortOrder, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`,
        args: [d.id, d.name, d.type, d.startTime, d.endTime, d.days, d.percentage, d.sortOrder],
      });
      console.log(`  ✓ ${d.name} (${d.percentage}%)`);
    } catch (err) {
      console.log(`  ⚠ ${d.name} already exists or error:`, err.message);
    }
  }

  console.log('Done!');
}

main().catch(console.error);

// Quick test of the API endpoints
const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://securityapp-qeeuz.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIzMDAwNTEsImlkIjoiMDE5Y2E1NGYtODcwMS03MTI3LWE1ZTUtZGE3ZWQzOTA1ZjVkIiwicmlkIjoiODY4MjljMTMtYjQ3NC00ZDgzLWIyZDAtNTE4ZTE1YzNmYTliIn0.4CILWqvSUDF4ALZ69Aoa5dRMIZrgYgPpuJN4KuUkceEMUXGSw6Rh94xQp_XYZsBN4DjB5GMcp9_U6X_rQ5khDg'
});

async function test() {
  // Verify tables exist and have proper structure
  console.log('=== Tables Check ===');
  
  const tables = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('Tables:', tables.rows.map(r => r.name).join(', '));
  
  // Check user_functies
  console.log('\n=== user_functies ===');
  const uf = await c.execute('SELECT * FROM user_functies');
  console.log('Rows:', uf.rows.length);
  uf.rows.forEach(r => console.log(JSON.stringify(r)));
  
  // Check user_kwalificaties
  console.log('\n=== user_kwalificaties ===');
  const uk = await c.execute('SELECT * FROM user_kwalificaties');
  console.log('Rows:', uk.rows.length);
  
  // Check kwalificaties
  console.log('\n=== kwalificaties ===');
  const kw = await c.execute('SELECT * FROM kwalificaties');
  console.log('Rows:', kw.rows.length);
  
  // Show all users with their functies
  console.log('\n=== Users + Functies ===');
  const users = await c.execute(`
    SELECT u.id, u.name, u.functieId as oldFunctieId, f.name as functieName
    FROM users u
    LEFT JOIN user_functies uf ON u.id = uf.userId
    LEFT JOIN functies f ON uf.functieId = f.id
  `);
  users.rows.forEach(r => console.log(JSON.stringify(r)));
  
  console.log('\nAll good!');
}

test().catch(e => console.error(e));

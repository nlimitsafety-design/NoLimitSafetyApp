// Test script for kwalificaties and multi-functie feature
const BASE = 'http://localhost:3001';

async function test() {
  // Step 1: Get CSRF token
  console.log('1. Getting CSRF token...');
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const cookies = csrfRes.headers.getSetCookie?.() || [];
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  
  // Collect cookies
  let cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
  console.log('   CSRF token:', csrfToken.substring(0, 20) + '...');
  
  // Step 2: Login
  console.log('2. Logging in as admin...');
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr,
    },
    body: `csrfToken=${csrfToken}&email=admin@securityapp.nl&password=Admin123!&json=true`,
    redirect: 'manual',
  });
  
  // Collect session cookies
  const loginCookies = loginRes.headers.getSetCookie?.() || [];
  const allCookies = [...cookies, ...loginCookies];
  cookieStr = allCookies.map(c => c.split(';')[0]).join('; ');
  console.log('   Login status:', loginRes.status);
  
  // Follow redirect to pick up session
  if (loginRes.status === 302 || loginRes.status === 200) {
    const sessionRes = await fetch(`${BASE}/api/auth/session`, {
      headers: { 'Cookie': cookieStr },
    });
    const sessionCookies = sessionRes.headers.getSetCookie?.() || [];
    if (sessionCookies.length > 0) {
      cookieStr = [...allCookies, ...sessionCookies].map(c => c.split(';')[0]).join('; ');
    }
    const session = await sessionRes.json();
    console.log('   Session user:', session.user?.name || 'NOT FOUND');
    if (!session.user) {
      console.error('   FAILED: No session. Cannot continue.');
      return;
    }
  }
  
  // Step 3: Test GET /api/employees
  console.log('\n3. GET /api/employees...');
  const empRes = await fetch(`${BASE}/api/employees`, {
    headers: { 'Cookie': cookieStr },
  });
  const employees = await empRes.json();
  if (Array.isArray(employees)) {
    console.log('   Found', employees.length, 'employees');
    const first = employees[0];
    console.log('   First employee:', first?.name);
    console.log('   Has functies array:', Array.isArray(first?.functies));
    console.log('   Has kwalificaties array:', Array.isArray(first?.kwalificaties));
    console.log('   Functies:', JSON.stringify(first?.functies));
    console.log('   Kwalificaties:', JSON.stringify(first?.kwalificaties));
  } else {
    console.error('   FAILED: Not an array:', JSON.stringify(employees).substring(0, 200));
  }
  
  // Step 4: Test GET /api/kwalificaties
  console.log('\n4. GET /api/kwalificaties...');
  const kwalRes = await fetch(`${BASE}/api/kwalificaties`, {
    headers: { 'Cookie': cookieStr },
  });
  const kwalificaties = await kwalRes.json();
  console.log('   Status:', kwalRes.status);
  console.log('   Kwalificaties:', JSON.stringify(kwalificaties));
  
  // Step 5: Create a kwalificatie
  console.log('\n5. POST /api/kwalificaties (create EHBO)...');
  const createKwalRes = await fetch(`${BASE}/api/kwalificaties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieStr },
    body: JSON.stringify({ name: 'EHBO' }),
  });
  const newKwal = await createKwalRes.json();
  console.log('   Status:', createKwalRes.status);
  console.log('   Created:', JSON.stringify(newKwal));
  
  // Step 6: Create another kwalificatie
  console.log('\n6. POST /api/kwalificaties (create BHV)...');
  const createKwal2Res = await fetch(`${BASE}/api/kwalificaties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieStr },
    body: JSON.stringify({ name: 'BHV' }),
  });
  const newKwal2 = await createKwal2Res.json();
  console.log('   Status:', createKwal2Res.status);
  console.log('   Created:', JSON.stringify(newKwal2));
  
  // Step 7: Test updating an employee with functies and kwalificaties
  if (employees.length > 0 && newKwal.id) {
    const testEmp = employees[0];
    console.log('\n7. PUT /api/employees/' + testEmp.id + ' (add kwalificaties)...');
    
    // Get functies
    const functiesRes = await fetch(`${BASE}/api/functies`, {
      headers: { 'Cookie': cookieStr },
    });
    const functies = await functiesRes.json();
    console.log('   Available functies:', functies.map(f => f.name).join(', '));
    
    const functieIds = functies.slice(0, 2).map(f => f.id);
    const kwalificatieIds = [newKwal.id, newKwal2.id].filter(Boolean);
    
    const updateRes = await fetch(`${BASE}/api/employees/${testEmp.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieStr },
      body: JSON.stringify({ 
        name: testEmp.name,
        email: testEmp.email,
        role: testEmp.role,
        hourlyRate: testEmp.hourlyRate,
        functieIds,
        kwalificatieIds,
      }),
    });
    const updated = await updateRes.json();
    console.log('   Status:', updateRes.status);
    console.log('   Functies:', JSON.stringify(updated.functies));
    console.log('   Kwalificaties:', JSON.stringify(updated.kwalificaties));
    
    if (updated.functies?.length > 0 && updated.kwalificaties?.length > 0) {
      console.log('   ✅ SUCCESS: Employee has multiple functies AND kwalificaties!');
    } else {
      console.log('   ❌ ISSUE: Expected functies and kwalificaties');
    }
  }
  
  // Step 8: Test conversation users endpoint
  console.log('\n8. GET /api/conversations/users...');
  const convUsersRes = await fetch(`${BASE}/api/conversations/users`, {
    headers: { 'Cookie': cookieStr },
  });
  const convUsers = await convUsersRes.json();
  if (Array.isArray(convUsers)) {
    console.log('   Found', convUsers.length, 'users');
    const first = convUsers[0];
    console.log('   Has functies array:', Array.isArray(first?.functies));
    console.log('   Sample:', JSON.stringify(first?.functies));
  } else {
    console.error('   FAILED:', JSON.stringify(convUsers).substring(0, 200));
  }
  
  console.log('\n=== ALL TESTS DONE ===');
}

test().catch(e => console.error('Test failed:', e));

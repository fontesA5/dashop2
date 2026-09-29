// scripts/verify-rls.js
// Verification script to test Supabase endpoints after applying 004-enable-rls.sql

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wninmlukmkdlrfgblobz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduaW5tbHVrbWtkbHJmZ2Jsb2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjgxOTAsImV4cCI6MjEwNTk0NDE5MH0.QahkI2kesSvnoehhwNHMLXRehqI1wCbJMztaW3_E6wg';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

async function verify() {
  console.log('Testing Supabase Endpoints at:', SUPABASE_URL);
  console.log('----------------------------------------------------');

  // 1. Products SELECT
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,price,stock&limit=3`, { headers });
    const data = await res.json();
    console.log(`[Products SELECT] Status ${res.status}:`, res.status === 200 ? `OK (${data.length} items returned)` : data);
  } catch (e) {
    console.error('[Products SELECT] Error:', e.message);
  }

  // 2. Orders SELECT
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id,customer_name,status,total&limit=3`, { headers });
    const data = await res.json();
    console.log(`[Orders SELECT] Status ${res.status}:`, res.status === 200 ? `OK (${data.length} items returned)` : data);
  } catch (e) {
    console.error('[Orders SELECT] Error:', e.message);
  }

  // 3. Admin Users SELECT
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=id,email,role,is_active`, { headers });
    const data = await res.json();
    console.log(`[Admin Users SELECT] Status ${res.status}:`, res.status === 200 ? `OK (${data.length} active admins returned)` : data);
  } catch (e) {
    console.error('[Admin Users SELECT] Error:', e.message);
  }

  // 4. Admin Users INSERT should be BLOCKED if RLS is enabled and no policy allows anon insert
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_users`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ email: 'hacker@test.com', password_hash: '123' })
    });
    if (res.status === 401 || res.status === 403 || res.status === 42501 || res.status === 400 || (res.status >= 400 && res.status < 500)) {
      console.log(`[Admin Users INSERT Test] Status ${res.status}: Properly BLOCKED! ✅`);
    } else if (res.status === 201) {
      console.log(`[Admin Users INSERT Test] Status ${res.status}: WARNING: Insert was allowed! RLS is not yet applied! ⚠️`);
    } else {
      const err = await res.text();
      console.log(`[Admin Users INSERT Test] Status ${res.status}:`, err);
    }
  } catch (e) {
    console.error('[Admin Users INSERT Test] Error:', e.message);
  }

  console.log('----------------------------------------------------');
}

verify();

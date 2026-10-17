import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
const { error } = await db.from('staff').upsert(
  { name: ADMIN_NAME || 'Admin', email: ADMIN_EMAIL.toLowerCase(), password_hash: hash, role: 'admin', active: true },
  { onConflict: 'email' });
if (error) { console.error(error.message); process.exit(1); }
console.log('Admin ready:', ADMIN_EMAIL);

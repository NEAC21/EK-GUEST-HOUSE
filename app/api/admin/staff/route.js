import bcrypt from 'bcryptjs';
import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  await requireStaff(['admin']);
  const { data } = await db().from('staff').select('id,name,email,role,active,created_at').order('created_at');
  return json({ staff: data });
});
export const POST = handle(async (req) => {
  await requireStaff(['admin']);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  if (!String(b.name || '').trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Enter a name and a valid email.');
  if (String(b.password || '').length < 8) fail(400, 'Password must be at least 8 characters.');
  if (!['admin', 'receptionist'].includes(b.role)) fail(400, 'Choose a role.');
  const { data, error } = await db().from('staff').insert({ name: b.name.trim(), email, role: b.role, password_hash: await bcrypt.hash(b.password, 10) }).select('id,name,email,role,active').single();
  if (error) fail(409, 'A staff member with that email already exists.');
  return json({ staff: data });
});

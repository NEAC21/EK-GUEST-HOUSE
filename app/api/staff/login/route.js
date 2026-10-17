import bcrypt from 'bcryptjs';
import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { signStaff } from '@/lib/auth';
export const POST = handle(async (req) => {
  const { email, password } = await req.json().catch(() => ({}));
  const { data: s } = await db().from('staff').select('*').eq('email', String(email || '').toLowerCase().trim()).eq('active', true).maybeSingle();
  if (!s || !(await bcrypt.compare(String(password || ''), s.password_hash))) fail(401, 'Wrong email or password.');
  const res = json({ name: s.name, role: s.role });
  res.cookies.set('staff_token', await signStaff(s), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 43200 });
  return res;
});

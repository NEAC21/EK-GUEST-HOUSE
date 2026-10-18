import bcrypt from 'bcryptjs';
import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { signStaff } from '@/lib/auth';
export const POST = handle(async (req) => {
  const { email, password } = await req.json().catch(() => ({}));
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fail(500, 'Server setup problem: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in Vercel. Add it, then redeploy.');
  }
  const { data: s, error } = await db().from('staff').select('*').eq('email', String(email || '').toLowerCase().trim()).eq('active', true).maybeSingle();
  if (error) {
    console.error('login db error', error);
    fail(500, 'Cannot read the database. Check that SUPABASE_URL and the service_role key in Vercel belong to the project where you ran schema.sql.');
  }
  if (!s || !(await bcrypt.compare(String(password || ''), s.password_hash))) fail(401, 'Wrong email or password.');
  const res = json({ name: s.name, role: s.role });
  res.cookies.set('staff_token', await signStaff(s), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 43200 });
  return res;
});

import bcrypt from 'bcryptjs';
import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
export const PUT = handle(async (req, { params }) => {
  const me = await requireStaff(['admin']);
  const b = await req.json().catch(() => ({}));
  const patch = {};
  if (b.active !== undefined) patch.active = !!b.active;
  if (b.role) { if (!['admin', 'receptionist'].includes(b.role)) fail(400, 'Invalid role.'); patch.role = b.role; }
  if (b.name) patch.name = String(b.name).trim();
  if (b.password) { if (String(b.password).length < 8) fail(400, 'Password must be at least 8 characters.'); patch.password_hash = await bcrypt.hash(b.password, 10); }
  if (params.id === me.id && (patch.active === false || (patch.role && patch.role !== 'admin'))) fail(400, 'You cannot lock yourself out.');
  const { error } = await db().from('staff').update(patch).eq('id', params.id);
  if (error) throw error;
  return json({ ok: true });
});

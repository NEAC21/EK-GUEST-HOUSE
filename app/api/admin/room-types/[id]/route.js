import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { clean } from '../route';
export const PUT = handle(async (req, { params }) => {
  await requireStaff(['admin']);
  const { data, error } = await db().from('room_types').update(clean(await req.json())).eq('id', params.id).select().single();
  if (error) throw error;
  return json({ type: data });
});
export const DELETE = handle(async (req, { params }) => {
  await requireStaff(['admin']);
  const { error } = await db().from('room_types').delete().eq('id', params.id);
  if (error) fail(409, 'This room type still has rooms or bookings. Hide it instead of deleting it.');
  return json({ ok: true });
});

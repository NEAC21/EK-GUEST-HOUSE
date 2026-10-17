import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
export const PUT = handle(async (req, { params }) => {
  await requireStaff(['admin']);
  const b = await req.json().catch(() => ({}));
  const patch = {};
  if (b.number !== undefined) patch.number = String(b.number).trim();
  if (b.room_type_id) patch.room_type_id = b.room_type_id;
  if (b.active !== undefined) patch.active = !!b.active;
  const { data, error } = await db().from('rooms').update(patch).eq('id', params.id).select().single();
  if (error) fail(409, 'Could not update the room (is the number already used?).');
  return json({ room: data });
});
export const DELETE = handle(async (req, { params }) => {
  await requireStaff(['admin']);
  const { error } = await db().from('rooms').delete().eq('id', params.id);
  if (error) fail(409, 'This room has bookings. Turn it off instead of deleting it.');
  return json({ ok: true });
});

import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  await requireStaff(['admin']);
  const { data } = await db().from('rooms').select('*, room_types(name)').order('number');
  return json({ rooms: data });
});
export const POST = handle(async (req) => {
  await requireStaff(['admin']);
  const b = await req.json().catch(() => ({}));
  const number = String(b.number || '').trim();
  if (!number || !b.room_type_id) fail(400, 'Enter the room number and choose a room type.');
  const { data, error } = await db().from('rooms').insert({ number, room_type_id: b.room_type_id }).select().single();
  if (error) fail(409, 'That room number already exists.');
  return json({ room: data });
});

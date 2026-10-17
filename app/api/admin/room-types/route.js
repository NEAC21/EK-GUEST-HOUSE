import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const clean = (b) => {
  const name = { en: String(b.name?.en || '').trim(), am: String(b.name?.am || '').trim(), om: String(b.name?.om || '').trim() };
  if (!name.en) fail(400, 'Enter the room name in English.');
  const price = Number(b.price_per_night);
  if (!(price >= 0)) fail(400, 'Enter a valid price.');
  return {
    name, description: { en: String(b.description?.en || ''), am: String(b.description?.am || ''), om: String(b.description?.om || '') },
    price_per_night: price, capacity: Math.max(1, Number(b.capacity) || 1),
    amenities: (b.amenities || []).map((x) => String(x).trim()).filter(Boolean),
    photos: (b.photos || []).filter((x) => typeof x === 'string'), active: b.active !== false,
  };
};
export const GET = handle(async () => {
  await requireStaff(['admin']);
  const { data } = await db().from('room_types').select('*').order('created_at');
  return json({ types: data });
});
export const POST = handle(async (req) => {
  await requireStaff(['admin']);
  const { data, error } = await db().from('room_types').insert(clean(await req.json())).select().single();
  if (error) throw error;
  return json({ type: data });
});

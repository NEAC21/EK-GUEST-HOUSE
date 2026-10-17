import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { validateRange, busyRoomIds } from '@/lib/booking';
export const dynamic = 'force-dynamic';
export const GET = handle(async (req) => {
  await requireStaff();
  const sp = new URL(req.url).searchParams;
  const inD = sp.get('in'), outD = sp.get('out');
  const e = validateRange(inD, outD); if (e) fail(400, e);
  const [{ data: rooms }, busy] = await Promise.all([
    db().from('rooms').select('id,number,room_types(id,name,price_per_night,capacity)').eq('active', true).order('number'),
    busyRoomIds(inD, outD),
  ]);
  return json({ rooms: (rooms || []).filter((r) => !busy.has(r.id)) });
});

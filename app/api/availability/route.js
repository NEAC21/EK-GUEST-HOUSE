import { json, handle, fail } from '@/lib/http';
import { availability, validateRange } from '@/lib/booking';
import { db } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export const GET = handle(async (req) => {
  const sp = new URL(req.url).searchParams;
  const inD = sp.get('in'), outD = sp.get('out'), guests = Number(sp.get('guests') || 0);
  let types;
  if (inD && outD) {
    const e = validateRange(inD, outD); if (e) fail(400, e);
    types = await availability(inD, outD);
    if (guests) types = types.filter((t) => t.capacity >= guests);
  } else {
    const { data } = await db().from('room_types').select('*').eq('active', true).order('price_per_night');
    types = (data || []).map((t) => ({ ...t, available: null }));
  }
  return json({ types });
});

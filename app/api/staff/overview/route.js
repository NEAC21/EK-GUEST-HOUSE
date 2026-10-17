import { json, handle } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { expireHolds, isDate, todayAddis, addDaysStr, refundFor } from '@/lib/booking';
export const dynamic = 'force-dynamic';
const COLS = 'id,reference,room_id,check_in,check_out,status,guest_name,guest_phone,total,payment_method,payment_reference,refund_amount,refund_status,rooms(number)';
export const GET = handle(async (req) => {
  await requireStaff(); await expireHolds();
  const sp = new URL(req.url).searchParams;
  const today = todayAddis();
  const from = isDate(sp.get('from')) ? sp.get('from') : today;
  const days = Math.min(31, Number(sp.get('days') || 14));
  const to = addDaysStr(from, days);
  const s = await getSettings();
  const [{ data: rooms }, { data: bookings }, { data: arrivals }, { data: departures }] = await Promise.all([
    db().from('rooms').select('id,number,room_types(name)').eq('active', true).order('number'),
    db().from('bookings').select(COLS).lt('check_in', to).gt('check_out', from).in('status', ['confirmed', 'checked_in', 'blocked', 'pending']),
    db().from('bookings').select(COLS).eq('check_in', today).eq('status', 'confirmed'),
    db().from('bookings').select(COLS).eq('check_out', today).eq('status', 'checked_in'),
  ]);
  const add = (b) => ({ ...b, suggested_refund: b.status === 'confirmed' ? refundFor(b, s).amount : 0 });
  return json({ today, from, days, rooms, bookings: (bookings || []).map(add), arrivals: (arrivals || []).map(add), departures: (departures || []).map(add) });
});

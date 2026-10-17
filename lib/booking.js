import { db } from './supabase';
export const todayAddis = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));
export const nightsBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export const addDaysStr = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export function validateRange(inD, outD) {
  if (!isDate(inD) || !isDate(outD)) return 'Choose valid dates.';
  if (inD < todayAddis()) return 'Check-in cannot be in the past.';
  const n = nightsBetween(inD, outD);
  if (n < 1) return 'Check-out must be after check-in.';
  if (n > 60) return 'The maximum stay is 60 nights.';
  return null;
}

export async function expireHolds() {
  await db().from('bookings').update({ status: 'expired' }).eq('status', 'pending').lt('hold_expires_at', new Date().toISOString());
}

export async function busyRoomIds(inD, outD) {
  await expireHolds();
  const { data } = await db().from('bookings').select('room_id')
    .lt('check_in', outD).gt('check_out', inD).in('status', ['confirmed', 'checked_in', 'blocked', 'pending']);
  return new Set((data || []).map((b) => b.room_id));
}

export async function availability(inD, outD) {
  const [{ data: types }, { data: rooms }, busy] = await Promise.all([
    db().from('room_types').select('*').eq('active', true).order('price_per_night'),
    db().from('rooms').select('id,room_type_id').eq('active', true),
    busyRoomIds(inD, outD),
  ]);
  return (types || []).map((t) => ({
    ...t, available: (rooms || []).filter((r) => r.room_type_id === t.id && !busy.has(r.id)).length,
  }));
}

// Refund policy: percent back if cancelled at least `refund_hours` before check-in (Addis Ababa time).
export function refundFor(b, s, now = Date.now()) {
  const start = Date.parse(`${b.check_in}T${s.check_in_time || '14:00'}:00+03:00`);
  const hoursLeft = (start - now) / 36e5;
  const eligible = hoursLeft >= Number(s.refund_hours);
  const percent = eligible ? Number(s.refund_percent) : 0;
  return { eligible, percent, amount: Math.round(Number(b.total) * percent) / 100, hoursLeft };
}

import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { getSettings } from '@/lib/settings';
import { expireHolds, refundFor } from '@/lib/booking';
import { settleBooking } from '@/lib/payments';
import { makeCode } from '@/lib/qr';
export const dynamic = 'force-dynamic';
const load = async (ref) => (await db().from('bookings').select('*, room_types(name)').eq('reference', ref).maybeSingle()).data;
export const GET = handle(async (req) => {
  const sp = new URL(req.url).searchParams;
  const ref = (sp.get('ref') || '').trim().toUpperCase(), email = (sp.get('email') || '').trim().toLowerCase();
  if (!ref || !email) fail(400, 'Booking reference and email are required.');
  await expireHolds();
  let b = await load(ref);
  if (!b || (b.guest_email || '') !== email) fail(404, 'Not found');
  if (['pending', 'expired'].includes(b.status)) { await settleBooking(ref); b = await load(ref); }
  const s = await getSettings();
  const preview = b.status === 'confirmed' ? refundFor(b, s) : null;
  const holdLeft = b.status === 'pending' && b.hold_expires_at ? Math.max(0, Math.floor((Date.parse(b.hold_expires_at) - Date.now()) / 1000)) : 0;
  return json({
    booking: {
      reference: b.reference, status: b.status, qr_code: b.status === 'confirmed' ? makeCode(b.reference) : null, guest_name: b.guest_name, check_in: b.check_in, check_out: b.check_out,
      nights: b.nights, guests: b.guests, total: b.total, room_type_name: b.room_types?.name,
      hold_seconds_left: holdLeft, checkout_url: holdLeft > 0 ? b.checkout_url : null,
      refund_amount: b.refund_amount, refund_status: b.refund_status,
      can_cancel: b.status === 'confirmed' && preview.hoursLeft > 0,
      refund_preview: preview && { eligible: preview.eligible, percent: preview.percent, amount: preview.amount },
    },
  });
});

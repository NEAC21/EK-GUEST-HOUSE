import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { parseCode } from '@/lib/qr';
import { todayAddis, expireHolds } from '@/lib/booking';
export const POST = handle(async (req) => {
  await requireStaff();
  const { code } = await req.json().catch(() => ({}));
  const p = parseCode(code);
  if (!p.ref) fail(400, 'Scan a QR code or type a code first.');
  if (p.signed && !p.valid) return json({ verdict: 'invalid', booking: null, message: 'This QR code is not valid. It may be fake or damaged. Ask the guest for their booking email.' });
  await expireHolds();
  const { data: b } = await db().from('bookings')
    .select('id,reference,status,guest_name,guest_phone,guests,check_in,check_out,nights,total,payment_method,payment_reference,rooms(number),room_types(name)')
    .eq('reference', p.ref).maybeSingle();
  if (!b) return json({ verdict: 'notfound', booking: null, message: 'No booking found for this code.' });
  const today = todayAddis();
  let verdict = 'ok', message = 'Valid booking. OK to check in.';
  if (b.status === 'checked_in') { verdict = 'checked_in'; message = 'This guest is already checked in.'; }
  else if (b.status === 'checked_out') { verdict = 'checked_out'; message = 'This guest has already checked out.'; }
  else if (b.status === 'cancelled') { verdict = 'cancelled'; message = 'This booking was cancelled.'; }
  else if (b.status === 'expired') { verdict = 'cancelled'; message = 'This booking expired without payment.'; }
  else if (b.status === 'pending') { verdict = 'unpaid'; message = 'Payment has not been received for this booking.'; }
  else if (b.status !== 'confirmed') { verdict = 'cancelled'; message = 'This is not a guest booking.'; }
  else if (today < b.check_in) { verdict = 'early'; message = `Check-in date is ${b.check_in}, not today. Early arrival: make sure the room is free.`; }
  else if (today >= b.check_out) { verdict = 'late'; message = `This stay ended on ${b.check_out}.`; }
  return json({ verdict, message, booking: b, manual: !p.signed });
});

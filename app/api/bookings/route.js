import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { getSettings } from '@/lib/settings';
import { validateRange, expireHolds } from '@/lib/booking';
import { initPayment } from '@/lib/chapa';
export const POST = handle(async (req) => {
  const b = await req.json().catch(() => ({}));
  const s = await getSettings();
  const err = validateRange(b.checkIn, b.checkOut); if (err) fail(400, err);
  const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase(), phone = String(b.phone || '').trim();
  if (name.length < 2) fail(400, 'Enter your full name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Enter a valid email address.');
  if (phone.replace(/\D/g, '').length < 9) fail(400, 'Enter a valid phone number.');
  const guests = Math.max(1, Number(b.guests) || 1);
  const { data: type } = await db().from('room_types').select('*').eq('id', b.typeId).eq('active', true).maybeSingle();
  if (!type) fail(404, 'Room type not found.');
  if (guests > type.capacity) fail(400, `This room fits up to ${type.capacity} guests.`);
  await expireHolds();
  const { data: bk, error } = await db().rpc('create_booking', {
    p_room_type: type.id, p_room: null, p_in: b.checkIn, p_out: b.checkOut,
    p_name: name, p_email: email, p_phone: phone, p_guests: guests,
    p_source: 'online', p_status: 'pending', p_hold_minutes: Number(s.hold_minutes) || 10,
    p_method: null, p_pay_ref: null, p_notes: null, p_by: null,
  });
  if (error) {
    if (error.message.includes('NO_AVAILABILITY')) fail(409, 'Sorry, this room type was just booked. Please choose other dates.');
    console.error(error); fail(500, 'Could not create the booking.');
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  try {
    const url = await initPayment({
      amount: bk.total, email, name, phone, txRef: bk.reference,
      returnUrl: `${site}/booking/${bk.reference}?e=${encodeURIComponent(email)}`,
      callbackUrl: `${site}/api/chapa/webhook`, title: s.name, description: `Room booking ${bk.reference}`,
    });
    await db().from('bookings').update({ checkout_url: url }).eq('id', bk.id);
    return json({ reference: bk.reference, checkoutUrl: url });
  } catch (e) {
    console.error(e);
    await db().from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', bk.id);
    fail(502, 'Payment could not be started. Please try again.');
  }
});

import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { getSettings } from '@/lib/settings';
import { refundFor } from '@/lib/booking';
import { notify } from '@/lib/email';
export const POST = handle(async (req) => {
  const { ref, email } = await req.json().catch(() => ({}));
  const { data: b } = await db().from('bookings').select('*').eq('reference', String(ref || '').trim().toUpperCase()).maybeSingle();
  if (!b || (b.guest_email || '') !== String(email || '').trim().toLowerCase()) fail(404, 'Booking not found.');
  if (b.status !== 'confirmed') fail(400, 'This booking cannot be cancelled online.');
  const s = await getSettings();
  const r = refundFor(b, s);
  if (r.hoursLeft <= 0) fail(400, 'Check-in time has passed. Please contact the guest house.');
  const { data, error } = await db().from('bookings').update({
    status: 'cancelled', cancelled_at: new Date().toISOString(),
    refund_amount: r.amount, refund_status: r.amount > 0 ? 'due' : 'none',
  }).eq('id', b.id).eq('status', 'confirmed').select().single();
  if (error) fail(409, 'This booking was already changed.');
  await notify('cancelled', data);
  return json({ refund_amount: data.refund_amount });
});

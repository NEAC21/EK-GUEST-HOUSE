import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { notify } from '@/lib/email';
export const PATCH = handle(async (req, { params }) => {
  const staff = await requireStaff();
  const { action, refundAmount } = await req.json().catch(() => ({}));
  const { data: b } = await db().from('bookings').select('*').eq('id', params.id).maybeSingle();
  if (!b) fail(404, 'Booking not found.');
  let patch;
  if (action === 'check_in') {
    if (b.status !== 'confirmed') fail(400, 'Only confirmed bookings can be checked in.');
    patch = { status: 'checked_in' };
  } else if (action === 'check_out') {
    if (b.status !== 'checked_in') fail(400, 'This guest is not checked in.');
    patch = { status: 'checked_out' };
  } else if (action === 'cancel') {
    if (!['confirmed', 'blocked', 'pending'].includes(b.status)) fail(400, 'This booking cannot be cancelled.');
    const amt = b.status === 'confirmed' ? Math.min(Math.max(Number(refundAmount) || 0, 0), Number(b.total)) : 0;
    patch = { status: 'cancelled', cancelled_at: new Date().toISOString(), refund_amount: amt, refund_status: amt > 0 ? 'due' : 'none' };
  } else if (action === 'refund_paid') {
    if (staff.role !== 'admin') fail(403, 'Only the admin can mark refunds as paid.');
    if (b.refund_status !== 'due') fail(400, 'No refund is due.');
    patch = { refund_status: 'paid' };
  } else fail(400, 'Unknown action.');
  const { data, error } = await db().from('bookings').update(patch).eq('id', b.id).select().single();
  if (error) throw error;
  if (action === 'cancel' && data.guest_email) await notify('cancelled', data);
  return json({ booking: data });
});

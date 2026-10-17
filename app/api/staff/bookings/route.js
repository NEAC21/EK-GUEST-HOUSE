import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { validateRange, expireHolds } from '@/lib/booking';
import { notify } from '@/lib/email';
export const dynamic = 'force-dynamic';
const COLS = '*, rooms(number), room_types(name)';

export const GET = handle(async (req) => {
  const staff = await requireStaff();
  await expireHolds();
  const sp = new URL(req.url).searchParams;
  let q = db().from('bookings').select(COLS).order('created_at', { ascending: false }).limit(500);
  if (sp.get('status')) q = q.eq('status', sp.get('status'));
  if (sp.get('from')) q = q.gte('check_in', sp.get('from'));
  if (sp.get('to')) q = q.lte('check_in', sp.get('to'));
  const s = (sp.get('q') || '').replace(/[^\p{L}\p{N} +@._-]/gu, '').trim();
  if (s) q = q.or(`guest_name.ilike.%${s}%,reference.ilike.%${s}%,guest_phone.ilike.%${s}%`);
  const { data, error } = await q;
  if (error) throw error;
  if (sp.get('format') === 'csv') {
    if (staff.role !== 'admin') fail(403, 'Admin only.');
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Reference', 'Guest', 'Phone', 'Email', 'Room', 'Check-in', 'Check-out', 'Nights', 'Total', 'Status', 'Source', 'Payment', 'Refund', 'Refund status'];
    const rows = data.map((b) => [b.reference, b.guest_name, b.guest_phone, b.guest_email, b.rooms?.number, b.check_in, b.check_out, b.nights, b.total, b.status, b.source, b.payment_method, b.refund_amount, b.refund_status].map(cell).join(','));
    return new Response([head.map(cell).join(','), ...rows].join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="bookings.csv"' } });
  }
  return json({ bookings: data });
});

export const POST = handle(async (req) => {
  const staff = await requireStaff();
  const b = await req.json().catch(() => ({}));
  const block = !!b.block;
  if (block && staff.role !== 'admin') fail(403, 'Only the admin can block rooms.');
  const err = validateRange(b.checkIn, b.checkOut); if (err) fail(400, err);
  if (!b.roomId) fail(400, 'Choose a room.');
  const name = block ? 'Blocked' : String(b.name || '').trim();
  if (!block && name.length < 2) fail(400, 'Enter the guest name.');
  const email = String(b.email || '').trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Enter a valid email or leave it empty.');
  const methods = ['cash', 'telebirr', 'bank_transfer', 'pos', 'pay_at_checkin'];
  const method = block ? null : (methods.includes(b.paymentMethod) ? b.paymentMethod : fail(400, 'Choose how the guest pays.'));
  await expireHolds();
  const { data: bk, error } = await db().rpc('create_booking', {
    p_room_type: null, p_room: b.roomId, p_in: b.checkIn, p_out: b.checkOut,
    p_name: name, p_email: email || null, p_phone: String(b.phone || '').trim() || null, p_guests: Math.max(1, Number(b.guests) || 1),
    p_source: 'reception', p_status: block ? 'blocked' : 'confirmed', p_hold_minutes: 0,
    p_method: method, p_pay_ref: String(b.paymentReference || '').trim() || null, p_notes: String(b.notes || '').trim() || null, p_by: staff.id,
  });
  if (error) {
    if (error.message.includes('ROOM_TAKEN')) fail(409, 'That room is already taken for these dates.');
    console.error(error); fail(500, 'Could not save the booking.');
  }
  if (!block && email) await notify('confirmed', bk);
  return json({ booking: bk });
});

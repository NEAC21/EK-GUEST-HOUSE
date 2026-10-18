import { db } from './supabase';
import { getSettings } from './settings';
import { makeCode } from './qr';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }),
    });
  } catch (e) { console.error('email failed', e); }
}
export async function notify(kind, b) {
  if (!b.guest_email) return;
  const s = await getSettings();
  const { data: t } = await db().from('room_types').select('name').eq('id', b.room_type_id).maybeSingle();
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const link = `${site}/booking/${b.reference}?e=${encodeURIComponent(b.guest_email)}`;
  const rows = `<table style="width:100%;border-collapse:collapse;font-size:15px">
    ${[['Reference', b.reference], ['Room', t?.name?.en || ''], ['Check-in', `${b.check_in} from ${s.check_in_time}`],
       ['Check-out', `${b.check_out} until ${s.check_out_time}`], ['Guests', b.guests], ['Total', `${b.total} ETB`]]
      .map(([k, v]) => `<tr><td style="padding:6px 0;color:#5C6B67">${k}</td><td style="padding:6px 0;text-align:right"><b>${esc(v)}</b></td></tr>`).join('')}</table>`;
  const policy = `<p style="font-size:14px;color:#5C6B67">Cancel at least ${s.refund_hours} hours before check-in for a ${s.refund_percent}% refund. Later cancellations are not refunded.</p>`;
  const code = makeCode(b.reference);
  const qr = `<div style="text-align:center;margin:16px 0"><img src="${site}/api/qr?code=${encodeURIComponent(code)}" width="180" height="180" alt="Check-in QR code" style="background:#fff" /><p style="margin:6px 0 0">Code: <b>${esc(code)}</b></p><p style="font-size:14px;color:#5C6B67;margin:4px 0">Show this QR code at reception when you arrive.</p></div>`;
  const msgs = {
    confirmed: ['Your booking is confirmed', `<p>Hello ${esc(b.guest_name)}, thank you. Your payment was received.</p>${rows}${qr}${policy}<p><a href="${link}">View or cancel your booking</a></p>`],
    cancelled: ['Your booking was cancelled', `<p>Hello ${esc(b.guest_name)}, your booking ${esc(b.reference)} was cancelled.</p>${b.refund_amount > 0 ? `<p>A refund of <b>${b.refund_amount} ETB</b> will be sent to you by the guest house.</p>` : '<p>No refund applies.</p>'}`],
    late: ['We could not keep your room', `<p>Hello ${esc(b.guest_name)}, your payment arrived after the 10-minute hold and the room was already taken. A full refund of <b>${b.refund_amount} ETB</b> will be sent to you. We are sorry.</p>${rows}`],
  };
  const [subject, body] = msgs[kind];
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14201E"><h2 style="color:${s.brand_color}">${esc(s.name)}</h2><h3>${subject}</h3>${body}<hr style="border:none;border-top:1px solid #ddd"/><p style="color:#5C6B67;font-size:13px">${esc(s.address)} ${esc(s.phone)}</p></div>`;
  await sendEmail({ to: b.guest_email, subject: `${subject} (${b.reference})`, html });
}

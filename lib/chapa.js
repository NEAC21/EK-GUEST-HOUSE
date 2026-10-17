const BASE = 'https://api.chapa.co/v1';
const headers = () => ({ Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`, 'Content-Type': 'application/json' });
function phoneOf(p) {
  const d = String(p || '').replace(/[\s-]/g, '').replace(/^\+251/, '0').replace(/^251/, '0');
  return /^0[79]\d{8}$/.test(d) ? d : null;
}
export async function initPayment({ amount, email, name, phone, txRef, returnUrl, callbackUrl, title, description }) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const body = {
    amount: String(amount), currency: 'ETB', email, first_name: first, last_name: rest.join(' ') || first,
    tx_ref: txRef, callback_url: callbackUrl, return_url: returnUrl,
    customization: { title: (title.replace(/[^a-zA-Z0-9 ._-]/g, '').slice(0, 16)) || 'Guest House', description },
  };
  const ph = phoneOf(phone); if (ph) body.phone_number = ph;
  const r = await fetch(`${BASE}/transaction/initialize`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== 'success') throw new Error('Chapa init failed: ' + JSON.stringify(j));
  return j.data.checkout_url;
}
export async function verifyPayment(txRef) {
  const r = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(txRef)}`, { headers: headers(), cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== 'success') return null;
  return j.data;
}

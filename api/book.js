const { db, createBooking, notify, getByRef, today, nightsBetween, validDate, newRef, handler, limited, mail } = require('./_lib/lib');
const local = p => { const d = String(p).replace(/\D/g, ''); const l = d.startsWith('251') ? '0' + d.slice(3) : d; return /^0[79]\d{8}$/.test(l) ? l : null; };

module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (await limited(req, 'book', 5, 10)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes or call us.' });
  const { room_id, name, email, phone, checkin, checkout, guests, agree, website } = req.body || {};
  if (website) return res.status(400).json({ error: 'Invalid request.' }); // honeypot field, bots fill it
  if (!agree) return res.status(400).json({ error: 'Please accept the terms and refund policy.' });
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || !phone || !validDate(checkin) || !validDate(checkout))
    return res.status(400).json({ error: 'Please fill in all fields correctly.' });
  const nights = nightsBetween(checkin, checkout);
  if (checkin < today()) return res.status(400).json({ error: 'Check-in cannot be in the past.' });
  if (nights < 1 || nights > 30) return res.status(400).json({ error: 'Stay must be between 1 and 30 nights.' });
  const room = (await db().query('SELECT * FROM rooms WHERE id=$1', [room_id])).rows[0];
  if (!room || room.price <= 0) return res.status(400).json({ error: 'This room is not open for online booking. Please call us.' });

  const open = (await db().query(`SELECT count(*) FROM bookings WHERE status='pending' AND created_at > now() - interval '10 minutes' AND (lower(email)=lower($1) OR phone=$2)`, [email, phone])).rows[0].count;
  if (Number(open) >= 2) return res.status(429).json({ error: 'You already have bookings waiting for payment. Please complete them or wait 10 minutes.' });

  const ref = newRef();
  const id = await createBooking({ ref, room_id: room.id, name: String(name).slice(0, 80), email, phone: String(phone).slice(0, 20), checkin, checkout, guests: String(guests || '1'), amount: room.price * nights }, 'pending');
  if (!id) return res.status(409).json({ error: 'Sorry, this room is not available for those dates.' });

  const [first, ...rest] = String(name).trim().split(/\s+/);
  const site = process.env.SITE_URL;
  const body = {
    amount: String(room.price * nights), currency: 'ETB', email, first_name: first, last_name: rest.join(' ') || first,
    tx_ref: ref, callback_url: `${site}/api/chapa-webhook`, return_url: `${site}/payment.html?ref=${ref}`,
    customization: { title: 'EK Pension', description: `Stay ${room.name.replace(/[^\w .-]/g, '')} ${nights} nights` }
  };
  if (local(phone)) body.phone_number = local(phone);
  const r = await fetch('https://api.chapa.co/v1/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  const url = j.data && j.data.checkout_url;
  if (!url) {
    console.error('Chapa init failed', JSON.stringify(j));
    await db().query(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [id]);
    await mail(process.env.ADMIN_EMAIL, 'ALERT: Chapa payment could not start', `Booking ${ref} failed to start payment.\nChapa said: ${JSON.stringify(j)}`).catch(() => {});
    return res.status(502).json({ error: 'Payment could not be started. Please try again or call us.' + (process.env.DEBUG_PAYMENTS ? ' [' + JSON.stringify(j.message || j) + ']' : '') });
  }
  await notify(await getByRef(ref), 'hold', url);
  res.json({ checkout_url: url, ref });
});

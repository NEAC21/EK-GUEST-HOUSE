const { db, BSEL, createBooking, isAdmin, makeToken, today, nightsBetween, validDate, newRef, handler } = require('./_lib/lib');

module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { action, ...d } = req.body || {};
  if (action === 'login') {
    if (d.password && d.password === process.env.ADMIN_PASSWORD) return res.json({ token: makeToken() });
    return res.status(401).json({ error: 'Wrong password' });
  }
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (action === 'setRoom') {
    await db().query('UPDATE rooms SET price=$2, quantity=$3 WHERE id=$1', [d.id, Math.max(0, +d.price | 0), Math.max(0, +d.quantity | 0)]);
  } else if (action === 'setSettings') {
    for (const k of ['checkin_time', 'checkout_time'])
      if (/^\d{2}:\d{2}$/.test(d[k] || '')) await db().query('INSERT INTO settings VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2', [k, d[k]]);
  } else if (action === 'cancel') {
    await db().query(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [d.id]);
  } else if (action === 'manual') {
    if (!d.name || !validDate(d.checkin) || !validDate(d.checkout) || d.checkout <= d.checkin) return res.status(400).json({ error: 'Check the name and dates.' });
    const room = (await db().query('SELECT * FROM rooms WHERE id=$1', [d.room_id])).rows[0];
    const id = room && await createBooking({ ref: newRef(), room_id: room.id, name: d.name, email: '', phone: d.phone || '', checkin: d.checkin, checkout: d.checkout, guests: '', amount: room.price * nightsBetween(d.checkin, d.checkout), source: 'manual', note: d.note || 'Paid cash' }, 'paid');
    if (!id) return res.status(409).json({ error: 'No room free for those dates.' });
  } else if (action !== 'list') return res.status(400).json({ error: 'Unknown action' });

  const rooms = (await db().query('SELECT * FROM rooms ORDER BY id')).rows;
  const settings = Object.fromEntries((await db().query('SELECT * FROM settings')).rows.map(r => [r.key, r.value]));
  const bookings = (await db().query(`${BSEL} ORDER BY b.created_at DESC LIMIT 300`)).rows;
  for (const b of bookings) // refund rule: online payment cancelled 24h+ before check-in
    b.refund_eligible = b.source === 'online' && Date.parse(`${b.checkin}T${settings.checkin_time}:00+03:00`) - Date.now() >= 24 * 3600e3;
  res.json({ rooms, settings, bookings, today: today() });
});

const { db, BSEL, createBooking, isAdmin, makeToken, today, nightsBetween, validDate, newRef, handler, limited, mail, whatsapp, ACTIVE } = require('./_lib/lib');

module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { action, ...d } = req.body || {};
  if (action === 'login') {
    if (await limited(req, 'login', 8, 15)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    if (d.password && d.password === process.env.ADMIN_PASSWORD) return res.json({ token: makeToken() });
    return res.status(401).json({ error: 'Wrong password' });
  }
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (action === 'setRoom') {
    await db().query('UPDATE rooms SET price=$2 WHERE id=$1', [d.id, Math.max(0, +d.price | 0)]);
    if (typeof d.labels === 'string') { // room numbers for this room type, e.g. "101, 102, 103"
      const want = [...new Set(d.labels.split(',').map(s => s.trim().slice(0, 20)).filter(Boolean))];
      const have = (await db().query('SELECT id,label FROM units WHERE room_id=$1', [d.id])).rows;
      for (const u of have) if (!want.includes(u.label)) {
        const used = (await db().query(`SELECT 1 FROM bookings b WHERE b.unit_id=$1 AND (b.status='paid' OR b.status='pending') AND b.checkout >= $2 LIMIT 1`, [u.id, today()])).rowCount;
        if (used) return res.status(409).json({ error: `Room ${u.label} has current or future bookings. Move or cancel them first.` });
        await db().query('UPDATE bookings SET unit_id=NULL WHERE unit_id=$1', [u.id]);
        await db().query('DELETE FROM units WHERE id=$1', [u.id]);
      }
      for (const l of want) if (!have.some(u => u.label === l)) await db().query('INSERT INTO units(room_id,label) VALUES($1,$2)', [d.id, l]);
      await db().query('UPDATE rooms SET quantity=(SELECT count(*) FROM units WHERE room_id=rooms.id) WHERE id=$1', [d.id]);
    }
  } else if (action === 'edit') { // change dates of a paid/pending booking, keeping its room number
    const b = (await db().query(`SELECT b.*, r.price FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE b.id=$1 AND b.status IN ('paid','pending')`, [d.id])).rows[0];
    if (!b || !validDate(d.checkin) || !validDate(d.checkout) || d.checkout <= d.checkin) return res.status(400).json({ error: 'Check the dates.' });
    if (!b.unit_id) return res.status(400).json({ error: 'Assign a room number to this booking first.' });
    const clash = (await db().query(`SELECT 1 FROM bookings b WHERE b.unit_id=$1 AND b.id<>$2 AND ${ACTIVE} AND b.checkin < $4 AND b.checkout > $3`, [b.unit_id, b.id, d.checkin, d.checkout])).rowCount;
    if (clash) return res.status(409).json({ error: 'That room is not free for the new dates.' });
    await db().query(`UPDATE bookings SET checkin=$2, checkout=$3, amount=CASE WHEN source='manual' THEN $4 ELSE amount END WHERE id=$1`, [b.id, d.checkin, d.checkout, b.price * nightsBetween(d.checkin, d.checkout)]);
  } else if (action === 'move') { // change which room number a booking uses
    const b = (await db().query('SELECT * FROM bookings WHERE id=$1', [d.id])).rows[0];
    const u = (await db().query('SELECT * FROM units WHERE id=$1', [d.unit_id])).rows[0];
    if (!b || !u || u.room_id !== b.room_id) return res.status(400).json({ error: 'Invalid room.' });
    const clash = (await db().query(`SELECT 1 FROM bookings b WHERE b.unit_id=$1 AND b.id<>$2 AND ${ACTIVE} AND b.checkin < $4 AND b.checkout > $3`, [u.id, b.id, b.checkin, b.checkout])).rowCount;
    if (clash) return res.status(409).json({ error: `Room ${u.label} is already taken on those dates.` });
    await db().query('UPDATE bookings SET unit_id=$2 WHERE id=$1', [b.id, u.id]);
  } else if (action === 'setSettings') {
    for (const k of ['checkin_time', 'checkout_time'])
      if (/^\d{2}:\d{2}$/.test(d[k] || '')) await db().query('INSERT INTO settings VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2', [k, d[k]]);
  } else if (action === 'cancel') {
    const b = (await db().query(`${BSEL} WHERE b.id=$1`, [d.id])).rows[0];
    if (b && b.status !== 'cancelled') {
      await db().query(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [d.id]);
      if (b.status === 'paid' && b.source === 'online') {
        const ci = (await db().query(`SELECT value FROM settings WHERE key='checkin_time'`)).rows[0].value;
        const ok = Date.parse(`${b.checkin}T${ci}:00+03:00`) - Date.now() >= 24 * 3600e3;
        const t = `Hello ${b.name}, your EK Pension booking ${b.ref} (${b.room}, ${b.checkin} to ${b.checkout}) was cancelled. ` +
          (ok ? 'You are eligible for a full refund and we will process it shortly.' : 'Under our policy it is not refundable because it is less than 24 hours before check-in. Call +251 921 414 245 for questions.');
        await Promise.allSettled([mail(b.email, `Booking cancelled - ${b.ref}`, t), whatsapp(b.phone, t)]);
      }
    }
  } else if (action === 'manual') {
    if (!d.name || !validDate(d.checkin) || !validDate(d.checkout) || d.checkout <= d.checkin) return res.status(400).json({ error: 'Check the name and dates.' });
    const room = (await db().query('SELECT * FROM rooms WHERE id=$1', [d.room_id])).rows[0];
    const id = room && await createBooking({ ref: newRef(), room_id: room.id, name: d.name, email: '', phone: d.phone || '', checkin: d.checkin, checkout: d.checkout, guests: '', amount: room.price * nightsBetween(d.checkin, d.checkout), source: 'manual', note: d.note || 'Paid cash', unit_id: d.unit_id ? +d.unit_id : null }, 'paid');
    if (!id) return res.status(409).json({ error: 'No room free for those dates.' });
  } else if (action !== 'list') return res.status(400).json({ error: 'Unknown action' });

  const rooms = (await db().query('SELECT * FROM rooms ORDER BY id')).rows;
  const settings = Object.fromEntries((await db().query('SELECT * FROM settings')).rows.map(r => [r.key, r.value]));
  const units = (await db().query('SELECT * FROM units ORDER BY room_id, label')).rows;
  const bookings = (await db().query(`${BSEL} ORDER BY b.created_at DESC LIMIT 300`)).rows;
  for (const b of bookings) // refund rule: online payment cancelled 24h+ before check-in
    b.refund_eligible = b.source === 'online' && Date.parse(`${b.checkin}T${settings.checkin_time}:00+03:00`) - Date.now() >= 24 * 3600e3;
  res.json({ rooms, units, settings, bookings, today: today() });
});

const { Pool, types } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
types.setTypeParser(1082, v => v); // keep DATE as 'YYYY-MM-DD'

const HOLD = 10; // minutes an unpaid booking holds a room
let pool, ready;
const db = () => pool || (pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 }));

async function init() {
  if (!ready) ready = (async () => {
    const q = (s, p) => db().query(s, p);
    await q(`CREATE TABLE IF NOT EXISTS rooms(id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, price INT NOT NULL DEFAULT 0, quantity INT NOT NULL DEFAULT 1)`);
    await q(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)`);
    await q(`CREATE TABLE IF NOT EXISTS bookings(id SERIAL PRIMARY KEY, ref TEXT UNIQUE NOT NULL, room_id INT REFERENCES rooms(id), name TEXT, email TEXT, phone TEXT, checkin DATE, checkout DATE, guests TEXT, amount INT, status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'online', note TEXT, created_at TIMESTAMPTZ DEFAULT now(), paid_at TIMESTAMPTZ)`);
    await q(`INSERT INTO rooms(name) VALUES ('Standard'),('Deluxe'),('Cozy Double'),('Connected Family') ON CONFLICT DO NOTHING`);
    await q(`INSERT INTO settings VALUES ('checkin_time','14:00'),('checkout_time','11:00') ON CONFLICT DO NOTHING`);
  })().catch(e => { ready = null; throw e; });
  return ready;
}

// pending bookings older than HOLD minutes are reported as 'expired'
const BSEL = `SELECT b.*, r.name AS room, CASE WHEN b.status='pending' AND b.created_at < now() - interval '${HOLD} minutes' THEN 'expired' ELSE b.status END AS status
  FROM bookings b JOIN rooms r ON r.id=b.room_id`;
const ACTIVE = `(b.status='paid' OR (b.status='pending' AND b.created_at > now() - interval '${HOLD} minutes'))`;

async function freeRooms(c, roomId, cin, cout) {
  const r = await c.query(`SELECT quantity - (SELECT count(*) FROM bookings b WHERE b.room_id=rooms.id AND ${ACTIVE} AND b.checkin < $3 AND b.checkout > $2) AS free FROM rooms WHERE id=$1`, [roomId, cin, cout]);
  return r.rows[0] ? Number(r.rows[0].free) : 0;
}

// Creates a booking only if a room is free (locked per room to prevent double booking)
async function createBooking(b, status) {
  const c = await db().connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock($1)', [b.room_id]);
    if ((await freeRooms(c, b.room_id, b.checkin, b.checkout)) < 1) { await c.query('ROLLBACK'); return null; }
    const r = await c.query(
      `INSERT INTO bookings(ref,room_id,name,email,phone,checkin,checkout,guests,amount,status,source,note,paid_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CASE WHEN $10='paid' THEN now() END) RETURNING id`,
      [b.ref, b.room_id, b.name, b.email, b.phone, b.checkin, b.checkout, b.guests, b.amount, status, b.source || 'online', b.note || null]);
    await c.query('COMMIT');
    return r.rows[0].id;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

async function getByRef(ref) {
  const r = await db().query(`${BSEL} WHERE b.ref=$1`, [ref]);
  return r.rows[0];
}

// Verifies with Chapa (never trusts the browser) and marks the booking paid
async function confirmPayment(ref) {
  const b = await getByRef(ref);
  if (!b || b.status === 'paid' || b.status === 'cancelled' || b.status === 'needs_refund') return b;
  const res = await fetch(`https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` } });
  const j = await res.json().catch(() => ({}));
  if (!(j.status === 'success' && j.data && j.data.status === 'success' && Number(j.data.amount) >= b.amount)) return b;
  let status = 'paid';
  if (b.status === 'expired' && (await freeRooms(db(), b.room_id, b.checkin, b.checkout)) < 1) status = 'needs_refund';
  const u = await db().query(`UPDATE bookings SET status=$2, paid_at=now() WHERE ref=$1 AND status='pending' RETURNING id`, [ref, status]);
  const nb = await getByRef(ref);
  if (u.rowCount) await notify(nb, status === 'paid' ? 'paid' : 'conflict');
  return nb;
}

/* ---------- notifications ---------- */
const money = n => `${Number(n).toLocaleString('en-US')} ETB`;
async function mail(to, subject, text) {
  if (!process.env.SMTP_HOST || !to) return;
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
}
function intl(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('251')) return d;
  if (d.startsWith('0')) return '251' + d.slice(1);
  return d.length === 9 ? '251' + d : d;
}
async function whatsapp(to, text) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID || !to) return;
  await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: intl(to), type: 'text', text: { body: text } })
  });
}
async function notify(b, kind, extra) {
  const s = Object.fromEntries((await db().query('SELECT * FROM settings')).rows.map(r => [r.key, r.value]));
  const stay = `${b.room}, ${b.checkin} to ${b.checkout} (${money(b.amount)})`;
  const msgs = {
    hold: [`Complete your EK Pension booking within ${HOLD} minutes`, `Hello ${b.name},\n\nWe are holding ${stay} for you for ${HOLD} minutes. Complete payment here:\n${extra}\n\nAfter ${HOLD} minutes the room is released. Ref: ${b.ref}`],
    paid: [`Booking confirmed - ${b.ref}`, `Hello ${b.name},\n\nYour payment was received and your stay is confirmed.\n\n${stay}\nCheck-in from ${s.checkin_time}, check-out by ${s.checkout_time}.\nRef: ${b.ref}\n\nCancellation: refund only if cancelled at least 24 hours before check-in. Call +251 921 414 245 to cancel.\n\nEK Pension, Chelenko Main Road`],
    conflict: [`Payment received - action needed ${b.ref}`, `Hello ${b.name},\n\nYour payment arrived after the ${HOLD}-minute hold and the room was no longer available. We will refund you in full. Please call +251 921 414 245.\nRef: ${b.ref}`]
  }[kind];
  const adminMsg = kind === 'hold' ? null : `${kind === 'paid' ? 'NEW PAID BOOKING' : 'PAID BUT ROOM TAKEN - REFUND NEEDED'}\n${b.name} ${b.phone}\n${stay}\nRef ${b.ref}`;
  const jobs = [mail(b.email, msgs[0], msgs[1]), whatsapp(b.phone, `${msgs[0]}\n\n${msgs[1]}`)];
  if (adminMsg) jobs.push(mail(process.env.ADMIN_EMAIL, adminMsg.split('\n')[0], adminMsg), whatsapp(process.env.ADMIN_WHATSAPP, adminMsg));
  await Promise.allSettled(jobs);
}

/* ---------- admin auth & helpers ---------- */
const sign = s => crypto.createHmac('sha256', (process.env.TOKEN_SECRET || '') + process.env.ADMIN_PASSWORD).update(s).digest('hex');
const makeToken = () => { const e = String(Date.now() + 12 * 3600e3); return `${e}.${sign(e)}`; };
function isAdmin(req) {
  const [e, sig] = (req.headers.authorization || '').replace('Bearer ', '').split('.');
  if (!e || !sig || Date.now() > Number(e)) return false;
  const good = sign(e);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
const nightsBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const newRef = () => 'EK-' + crypto.randomBytes(5).toString('hex').toUpperCase();
const handler = fn => async (req, res) => {
  try { await init(); await fn(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Server error. Please try again or call us.' }); }
};

module.exports = { db, init, BSEL, freeRooms, createBooking, getByRef, confirmPayment, notify, isAdmin, makeToken, today, nightsBetween, validDate, newRef, handler, HOLD, money };

const { db, freeRooms, validDate, handler, HOLD } = require('./_lib/lib');
module.exports = handler(async (req, res) => {
  const { checkin, checkout } = req.query;
  const rooms = (await db().query('SELECT id,name,price,quantity FROM rooms ORDER BY id')).rows;
  if (validDate(checkin) && validDate(checkout) && checkout > checkin)
    for (const r of rooms) r.free = await freeRooms(db(), r.id, checkin, checkout);
  const settings = Object.fromEntries((await db().query('SELECT * FROM settings')).rows.map(r => [r.key, r.value]));
  res.json({ rooms, settings, hold: HOLD });
});

const { confirmPayment, handler } = require('./_lib/lib');
module.exports = handler(async (req, res) => {
  const b = await confirmPayment(String(req.query.ref || ''));
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  res.json({ status: b.status, ref: b.ref, room: b.room, checkin: b.checkin, checkout: b.checkout, amount: b.amount, name: b.name });
});

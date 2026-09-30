const { confirmPayment, handler } = require('./_lib/lib');
// Chapa calls this (GET callback or POST webhook). We never trust the payload: we re-verify with Chapa.
module.exports = handler(async (req, res) => {
  const ref = (req.query && (req.query.trx_ref || req.query.tx_ref)) || (req.body && (req.body.tx_ref || req.body.trx_ref));
  if (ref) await confirmPayment(String(ref));
  res.status(200).send('ok');
});

import { json, handle } from '@/lib/http';
import { settleBooking } from '@/lib/payments';
// Chapa calls this after payment. We never trust the body: we ask Chapa to verify the reference.
const run = async (req) => {
  const sp = new URL(req.url).searchParams;
  let ref = sp.get('trx_ref') || sp.get('tx_ref');
  if (!ref && req.method === 'POST') { const b = await req.json().catch(() => ({})); ref = b.tx_ref || b.trx_ref; }
  if (ref) await settleBooking(ref);
  return json({ ok: true });
};
export const dynamic = 'force-dynamic';
export const GET = handle(run);
export const POST = handle(run);

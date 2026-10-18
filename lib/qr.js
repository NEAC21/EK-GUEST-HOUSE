import crypto from 'crypto';
// The QR holds "REFERENCE.SIGNATURE". The signature can only be made by this server, so a guessed or edited code fails.
const secret = () => process.env.JWT_SECRET || 'dev-only-secret';
const sig = (ref) => crypto.createHmac('sha256', secret()).update('checkin:' + ref).digest('base64url').slice(0, 12);
export const makeCode = (ref) => `${ref}.${sig(ref)}`;
export function parseCode(input) {
  const [ref, s] = String(input || '').trim().split('.');
  const R = (ref || '').trim().toUpperCase();
  if (!R) return { ref: null };
  if (!s) return { ref: R, signed: false };
  const a = Buffer.from(s), b = Buffer.from(sig(R));
  return { ref: R, signed: true, valid: a.length === b.length && crypto.timingSafeEqual(a, b) };
}

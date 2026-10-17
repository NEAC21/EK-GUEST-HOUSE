import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { fail } from './http';
const key = () => new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-secret');
export const signStaff = (s) =>
  new SignJWT({ id: s.id, role: s.role, name: s.name }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('12h').sign(key());
export async function getStaff() {
  const t = cookies().get('staff_token')?.value;
  if (!t) return null;
  try { return (await jwtVerify(t, key())).payload; } catch { return null; }
}
export async function requireStaff(roles = ['admin', 'receptionist']) {
  const s = await getStaff();
  if (!s) fail(401, 'Please sign in.');
  if (!roles.includes(s.role)) fail(403, 'You do not have access to this.');
  return s;
}

import { json, handle } from '@/lib/http';
export const POST = handle(async () => {
  const res = json({ ok: true });
  res.cookies.set('staff_token', '', { path: '/', maxAge: 0 });
  return res;
});

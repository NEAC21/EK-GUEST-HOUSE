import { json, handle } from '@/lib/http';
import { db } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
// Temporary setup check: shows which variables exist (never their values) and whether the database answers.
export const GET = handle(async () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const keyType = !key ? 'missing' : key.startsWith('sb_secret_') ? 'secret key (ok)' : key.startsWith('sb_publishable_') ? 'PUBLISHABLE key (wrong, use the secret key)'
    : key.split('.').length === 3 ? 'legacy service_role/anon JWT' : 'unknown format';
  const env = {
    SUPABASE_URL_present: !!url,
    SUPABASE_URL_looks_right: /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url),
    SUPABASE_SERVICE_ROLE_KEY: keyType,
    JWT_SECRET_present: !!process.env.JWT_SECRET,
    CHAPA_SECRET_KEY_present: !!process.env.CHAPA_SECRET_KEY,
    NEXT_PUBLIC_SITE_URL_present: !!process.env.NEXT_PUBLIC_SITE_URL,
  };
  let db_ok = false, staff_rows = null, error = null;
  try {
    const { count, error: e } = await db().from('staff').select('id', { count: 'exact', head: true });
    if (e) error = e.message; else { db_ok = true; staff_rows = count; }
  } catch (e) { error = String(e.message || e); }
  return json({ env, db_ok, staff_rows, error });
});

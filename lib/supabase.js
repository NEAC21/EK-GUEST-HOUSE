import { createClient } from '@supabase/supabase-js';
let client;
export function db() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      // Next.js caches fetch() answers by default; the hotel data must always be fresh.
      global: { fetch: (input, init = {}) => fetch(input, { ...init, cache: 'no-store' }) },
    });
  }
  return client;
}

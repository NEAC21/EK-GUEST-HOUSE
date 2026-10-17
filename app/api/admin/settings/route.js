import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
const TEXT = ['name', 'tagline', 'phone', 'email', 'address', 'map_url', 'hero_image'];
const NUM = ['hold_minutes', 'refund_percent', 'refund_hours'];
export const PUT = handle(async (req) => {
  await requireStaff(['admin']);
  const b = await req.json().catch(() => ({}));
  const cur = await getSettings();
  const next = { ...cur };
  for (const k of TEXT) if (b[k] !== undefined) next[k] = String(b[k]).trim();
  for (const k of NUM) if (b[k] !== undefined) next[k] = Number(b[k]);
  for (const k of ['brand_color', 'accent_color']) if (b[k] !== undefined) { if (!/^#[0-9a-fA-F]{6}$/.test(b[k])) fail(400, 'Colors must look like #0F3D36.'); next[k] = b[k]; }
  for (const k of ['check_in_time', 'check_out_time']) if (b[k] !== undefined) { if (!/^\d{2}:\d{2}$/.test(b[k])) fail(400, 'Times must look like 14:00.'); next[k] = b[k]; }
  if (!(next.hold_minutes >= 1 && next.hold_minutes <= 60)) fail(400, 'Hold time must be between 1 and 60 minutes.');
  if (!(next.refund_percent >= 0 && next.refund_percent <= 100)) fail(400, 'Refund percent must be between 0 and 100.');
  if (!(next.refund_hours >= 0)) fail(400, 'Refund hours must be 0 or more.');
  const { error } = await db().from('settings').upsert({ id: 1, data: next });
  if (error) throw error;
  return json({ settings: next });
});

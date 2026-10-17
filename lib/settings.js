import { db } from './supabase';
export const DEFAULTS = {
  name: 'EK Guest House', tagline: 'A quiet place to stay.',
  phone: '', email: '', address: '', map_url: '', hero_image: '',
  brand_color: '#0F3D36', accent_color: '#B38B4D',
  check_in_time: '14:00', check_out_time: '11:00',
  hold_minutes: 10, refund_percent: 80, refund_hours: 48,
};
export async function getSettings() {
  const { data } = await db().from('settings').select('data').eq('id', 1).maybeSingle();
  return { ...DEFAULTS, ...(data?.data || {}) };
}

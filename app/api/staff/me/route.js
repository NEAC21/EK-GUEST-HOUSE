import { json, handle } from '@/lib/http';
import { requireStaff } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const GET = handle(async () => { const s = await requireStaff(); return json({ id: s.id, name: s.name, role: s.role }); });

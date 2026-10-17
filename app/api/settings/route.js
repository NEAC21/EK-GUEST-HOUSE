import { json, handle } from '@/lib/http';
import { getSettings } from '@/lib/settings';
export const dynamic = 'force-dynamic';
export const GET = handle(async () => json(await getSettings()));

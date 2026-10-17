import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
export const POST = handle(async (req) => {
  await requireStaff(['admin']);
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.type?.startsWith('image/')) fail(400, 'Choose an image file.');
  if (file.size > 4 * 1024 * 1024) fail(400, 'Image is too large (max 4 MB).');
  const folder = form.get('folder') === 'site' ? 'site' : 'rooms';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await db().storage.from('rooms').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) { console.error(error); fail(500, 'Upload failed. Check that the "rooms" storage bucket exists.'); }
  return json({ url: db().storage.from('rooms').getPublicUrl(path).data.publicUrl });
});

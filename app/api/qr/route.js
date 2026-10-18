import QRCode from 'qrcode';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const code = new URL(req.url).searchParams.get('code') || '';
  if (!code || code.length > 80) return new Response('Bad request', { status: 400 });
  const buf = await QRCode.toBuffer(code, { width: 360, margin: 2, errorCorrectionLevel: 'M' });
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
}

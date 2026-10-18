// Turns whatever the admin typed into something the website can show:
// coordinates ("8.7500, 38.9800"), a Google Maps link, an <iframe> embed code, or a plain place name.
export function parseMap(input, address = '') {
  let v = String(input || '').trim();
  const iframe = v.match(/src=["']([^"']+)["']/i);
  if (iframe) v = iframe[1];
  const place = (q) => ({
    embed: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`,
    open: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
  });
  if (!v) return address ? place(address) : null;
  if (/^https:\/\/[^ ]*(\/maps\/embed|output=embed)/i.test(v)) return { embed: v, open: null };
  const m = v.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || v.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) || v.match(/(-?\d{1,3}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/);
  if (m) {
    const lat = Number(m[1]), lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return place(`${lat},${lng}`);
  }
  if (/^https?:\/\//i.test(v)) return { embed: null, open: v };   // short link: cannot be embedded, show a button
  return place(v);
}

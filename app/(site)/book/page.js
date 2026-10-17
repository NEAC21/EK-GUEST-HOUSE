'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { api, fmtDate } from '@/lib/client';

function Inner() {
  const sp = useSearchParams();
  const typeId = sp.get('type'), inD = sp.get('in'), outD = sp.get('out'), guests = Number(sp.get('guests') || 2);
  const { t, tr, settings } = useApp();
  const [type, setType] = useState(null), [state, setState] = useState('loading'), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', email: '', phone: '' });
  useEffect(() => {
    if (!typeId || !inD || !outD) { setState('none'); return; }
    api(`/api/availability?in=${inD}&out=${outD}&guests=${guests}`)
      .then((d) => { const x = d.types.find((r) => r.id === typeId); setType(x || null); setState(x && x.available > 0 ? 'ok' : 'none'); })
      .catch((e) => { setErr(e.message); setState('none'); });
  }, [typeId, inD, outD, guests]);
  const nights = Math.round((Date.parse(outD) - Date.parse(inD)) / 864e5);
  const total = type ? type.price_per_night * nights : 0;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const d = await api('/api/bookings', { method: 'POST', body: { typeId, checkIn: inD, checkOut: outD, guests, ...f } }); window.location.href = d.checkoutUrl; }
    catch (e2) { setErr(e2.message); setBusy(false); }
  };
  if (state === 'loading') return <div className="wrap pad"><p>{t('loading')}</p></div>;
  if (state === 'none') return <div className="wrap pad"><p>{err || t('no_rooms')}</p><Link className="btn" href="/">{t('change_dates')}</Link></div>;
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <h2 style={{ fontSize: 36, marginBottom: 24 }}>{t('checkout_title')}</h2>
      <div className="two">
        <form className="card" onSubmit={submit}>
          <h3 style={{ marginBottom: 16 }}>{t('your_details')}</h3>
          <div className="field"><label htmlFor="n">{t('full_name')}</label><input id="n" required value={f.name} onChange={set('name')} autoComplete="name" /></div>
          <div className="field"><label htmlFor="e">{t('email')}</label><input id="e" type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></div>
          <div className="field"><label htmlFor="p">{t('phone')}</label><input id="p" type="tel" required value={f.phone} onChange={set('phone')} autoComplete="tel" /></div>
          {err && <p className="err">{err}</p>}
          <button className="btn gold" disabled={busy} style={{ width: '100%' }}>{busy ? t('loading') : t('pay_now', { amount: total.toLocaleString() })}</button>
          <p className="note">{t('payment_note')}</p>
          <p className="note">{t('hold_note', { m: settings.hold_minutes })}</p>
        </form>
        <aside className="card">
          {type.photos?.[0] && <img src={type.photos[0]} alt={tr(type.name)} style={{ borderRadius: 12, marginBottom: 14, width: '100%', height: 180, objectFit: 'cover' }} />}
          <h3>{tr(type.name)}</h3>
          <dl className="sum" style={{ marginTop: 14 }}>
            <dt>{t('check_in')}</dt><dd>{fmtDate(inD)} · {settings.check_in_time}</dd>
            <dt>{t('check_out')}</dt><dd>{fmtDate(outD)} · {settings.check_out_time}</dd>
            <dt>{t('guests')}</dt><dd>{guests}</dd>
            <dt>{Number(type.price_per_night).toLocaleString()} ETB × {nights} {nights === 1 ? t('night') : t('nights')}</dt>
            <dd style={{ fontSize: 22 }}>{t('total')}: {total.toLocaleString()} ETB</dd>
          </dl>
          <p className="note">{t('policy', { h: settings.refund_hours, p: settings.refund_percent })}</p>
        </aside>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense fallback={<div className="wrap pad">…</div>}><Inner /></Suspense>; }

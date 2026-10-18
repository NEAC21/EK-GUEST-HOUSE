'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { api, fmtDate } from '@/lib/client';

function Inner() {
  const { ref } = useParams(); const sp = useSearchParams();
  const { t, tr, settings } = useApp();
  const email = sp.get('e') || '';
  const [b, setB] = useState(null), [err, setErr] = useState(''), [msg, setMsg] = useState(''), [now, setNow] = useState(Date.now());
  const fetchIt = async () => {
    if (!email) return;
    try { const d = await api(`/api/bookings/lookup?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`); setB({ ...d.booking, _at: Date.now() }); setErr(''); }
    catch (e) { setErr(e.status === 404 ? t('not_found') : e.message); }
  };
  useEffect(() => { fetchIt(); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (b?.status === 'pending') { const id = setInterval(fetchIt, 5000); return () => clearInterval(id); } }, [b?.status]);

  const cancel = async () => {
    const p = b.refund_preview;
    const q = p?.eligible ? t('cancel_ask_refund', { amount: p.amount, p: p.percent }) : t('cancel_ask_none', { h: settings.refund_hours });
    if (!window.confirm(q)) return;
    try { const d = await api('/api/bookings/cancel', { method: 'POST', body: { ref, email } }); setMsg(t('cancelled_done') + (d.refund_amount > 0 ? ' ' + t('refund_due', { amount: d.refund_amount }) : '')); fetchIt(); }
    catch (e) { setErr(e.message); }
  };
  if (!email) return <div className="wrap pad"><p>{t('not_found')}</p></div>;
  if (err && !b) return <div className="wrap pad"><p className="err">{err}</p></div>;
  if (!b) return <div className="wrap pad"><p>{t('verifying')}</p></div>;
  const left = Math.max(0, b.hold_seconds_left - Math.floor((now - b._at) / 1000));
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <div className="wrap" style={{ paddingTop: 40, maxWidth: 640 }}>
      <div className="card">
        <span className={'status ' + b.status}>{t('status_' + b.status)}</span>
        <h2 style={{ margin: '14px 0 4px' }}>{tr(b.room_type_name)}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{t('reference')}: <b>{b.reference}</b></p>
        <dl className="sum">
          <dt>{t('check_in')}</dt><dd>{fmtDate(b.check_in)} · {settings.check_in_time}</dd>
          <dt>{t('check_out')}</dt><dd>{fmtDate(b.check_out)} · {settings.check_out_time}</dd>
          <dt>{t('guests')}</dt><dd>{b.guests}</dd>
          <dt>{t('total')}</dt><dd>{Number(b.total).toLocaleString()} ETB</dd>
        </dl>
        {b.status === 'pending' && left > 0 && <>
          <p><b>{t('time_left', { t: mm })}</b></p>
          {b.checkout_url && <a className="btn gold" href={b.checkout_url}>{t('continue_payment')}</a>}
          <p className="note">{t('verifying')}</p>
        </>}
        {b.qr_code && b.status === 'confirmed' && (
          <div style={{ textAlign: 'center', margin: '18px 0' }}>
            <h3 style={{ fontSize: 18, marginBottom: 10 }}>{t('qr_title')}</h3>
            <img src={`/api/qr?code=${encodeURIComponent(b.qr_code)}`} alt={b.qr_code} width="220" height="220" style={{ margin: '0 auto', background: '#fff', padding: 8, borderRadius: 12 }} />
            <p className="note" style={{ margin: '8px 0' }}>{b.qr_code}<br />{t('qr_help')}</p>
            <a className="btn ghost sm" download={`checkin-${b.reference}.png`} href={`/api/qr?code=${encodeURIComponent(b.qr_code)}`}>{t('qr_save')}</a>
          </div>)}
        {b.status === 'confirmed' && <p className="note">{t('policy', { h: settings.refund_hours, p: settings.refund_percent })}</p>}
        {b.refund_status !== 'none' && Number(b.refund_amount) > 0 && <p className="ok">{t('refund_due', { amount: Number(b.refund_amount).toLocaleString() })}</p>}
        {b.can_cancel && <button className="btn danger" onClick={cancel}>{t('cancel_booking')}</button>}
        {msg && <p className="ok">{msg}</p>}
        {err && <p className="err">{err}</p>}
        {settings.phone && <p className="note" style={{ marginTop: 18 }}>{settings.phone}</p>}
      </div>
    </div>
  );
}
export default function Page() { return <Suspense fallback={<div className="wrap pad">…</div>}><Inner /></Suspense>; }

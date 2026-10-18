'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
export default function Find() {
  const { t } = useApp(); const r = useRouter();
  const [ref, setRef] = useState(''), [email, setEmail] = useState('');
  return (
    <div className="wrap" style={{ paddingTop: 40, maxWidth: 520 }}>
      <form className="card" onSubmit={(e) => { e.preventDefault(); r.push(`/booking/${ref.trim().toUpperCase()}?e=${encodeURIComponent(email.trim())}`); }}>
        <h2 style={{ marginBottom: 18 }}>{t('my_booking')}</h2>
        <div className="field"><label htmlFor="r">{t('reference')}</label><input id="r" required value={ref} onChange={(e) => setRef(e.target.value)} placeholder="EK1A2B3C4D" /></div>
        <div className="field"><label htmlFor="m">{t('email')}</label><input id="m" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <button className="btn">{t('find')}</button>
      </form>
    </div>
  );
}

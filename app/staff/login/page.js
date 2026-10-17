'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const d = await api('/api/staff/login', { method: 'POST', body: { email, password } }); r.replace(d.role === 'admin' ? '/admin' : '/reception'); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <form className="card" onSubmit={go}>
        <h2 style={{ marginBottom: 18 }}>Staff sign in</h2>
        <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
        <div className="field"><label htmlFor="p">Password</label><input id="p" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy} style={{ width: '100%' }}>Sign in</button>
      </form>
    </div>
  );
}

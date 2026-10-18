'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
export default function StaffShell({ roles, children }) {
  const r = useRouter(); const [s, setS] = useState(null);
  useEffect(() => {
    api('/api/staff/me').then((d) => { if (roles && !roles.includes(d.role)) r.replace('/reception'); else setS(d); }).catch(() => r.replace('/staff/login'));
  }, []);
  if (!s) return <p className="pad">Loading…</p>;
  const out = async () => { await api('/api/staff/logout', { method: 'POST' }); r.replace('/staff/login'); };
  return (
    <>
      <header className="shdr">
        <b style={{ fontFamily: 'Fraunces,serif', fontSize: 20 }}>Staff</b>
        <nav>
          <Link href="/reception">Reception</Link>
          {s.role === 'admin' && <Link href="/admin">Admin</Link>}
          <a href="/">Website</a>
          <span style={{ opacity: .8 }}>{s.name}</span>
          <button className="btn sm gold" onClick={out}>Sign out</button>
        </nav>
      </header>
      <main className="smain">{children(s)}</main>
    </>
  );
}

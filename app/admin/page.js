'use client';
import { useCallback, useEffect, useState } from 'react';
import StaffShell from '@/components/StaffShell';
import { api, money, fmtDate, compressImage } from '@/lib/client';

export default function Admin() { return <StaffShell roles={['admin']}>{() => <Tabs />}</StaffShell>; }

function Tabs() {
  const [tab, setTab] = useState('bookings');
  const T = [['bookings', 'Bookings'], ['types', 'Room types'], ['rooms', 'Rooms'], ['settings', 'Settings'], ['staff', 'Staff']];
  return (
    <>
      <div className="tabs">{T.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'bookings' && <Bookings />}{tab === 'types' && <Types />}{tab === 'rooms' && <Rooms />}
      {tab === 'settings' && <Settings />}{tab === 'staff' && <Staff />}
    </>
  );
}

function Bookings() {
  const [rows, setRows] = useState([]), [err, setErr] = useState('');
  const [fl, setFl] = useState({ status: '', q: '', from: '', to: '' });
  const qs = new URLSearchParams(Object.entries(fl).filter(([, v]) => v)).toString();
  const load = useCallback(async () => { try { setRows((await api('/api/staff/bookings?' + qs)).bookings); setErr(''); } catch (e) { setErr(e.message); } }, [qs]);
  useEffect(() => { load(); }, [load]);
  const act = async (b, action) => {
    let refundAmount;
    if (action === 'cancel') { const v = window.prompt('Refund amount in ETB (0 for none):', '0'); if (v === null) return; refundAmount = Number(v); }
    try { await api(`/api/staff/bookings/${b.id}`, { method: 'PATCH', body: { action, refundAmount } }); load(); } catch (e) { setErr(e.message); }
  };
  const ok = rows.filter((b) => ['confirmed', 'checked_in', 'checked_out'].includes(b.status));
  const due = rows.filter((b) => b.refund_status === 'due');
  const set = (k) => (e) => setFl({ ...fl, [k]: e.target.value });
  return (
    <>
      <div className="grid2">
        <div className="stat"><span className="muted">Active bookings</span><b>{ok.length}</b></div>
        <div className="stat"><span className="muted">Booked value</span><b>{money(ok.reduce((s, b) => s + Number(b.total), 0))}</b></div>
        <div className="stat"><span className="muted">Refunds to pay</span><b>{money(due.reduce((s, b) => s + Number(b.refund_amount), 0))}</b></div>
      </div>
      <h2>All bookings</h2>
      <div className="inline" style={{ marginBottom: 12 }}>
        <div className="field"><label>Status</label><select value={fl.status} onChange={set('status')}><option value="">All</option>{['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'expired', 'blocked'].map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label>Search</label><input value={fl.q} onChange={set('q')} placeholder="Name, phone, reference" /></div>
        <div className="field"><label>Check-in from</label><input type="date" value={fl.from} onChange={set('from')} /></div>
        <div className="field"><label>to</label><input type="date" value={fl.to} onChange={set('to')} /></div>
        <a className="btn ghost" href={'/api/staff/bookings?format=csv&' + qs}>Export CSV</a>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="scroll"><table className="tbl"><thead><tr><th>Ref</th><th>Guest</th><th>Room</th><th>Dates</th><th>Total</th><th>Status</th><th>Payment</th><th /></tr></thead><tbody>
        {rows.map((b) => (
          <tr key={b.id}><td>{b.reference}</td><td>{b.guest_name}<br /><span className="muted">{b.guest_phone}</span></td><td>{b.rooms?.number}</td>
            <td>{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</td><td>{money(b.total)}</td><td>{b.status.replace('_', ' ')}</td>
            <td>{(b.payment_method || '').replace('_', ' ')}{b.refund_status !== 'none' && <><br /><b style={{ color: 'var(--danger)' }}>Refund {b.refund_status}: {money(b.refund_amount)}</b></>}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              {b.refund_status === 'due' && <button className="btn sm gold" onClick={() => act(b, 'refund_paid')}>Mark refund paid</button>}{' '}
              {['confirmed', 'pending', 'blocked'].includes(b.status) && <button className="btn sm danger" onClick={() => act(b, 'cancel')}>Cancel</button>}
            </td></tr>))}
      </tbody></table></div>
      {rows.length === 0 && <p className="muted">No bookings yet.</p>}
    </>
  );
}

function Photos({ value, onChange, folder = 'rooms', single }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const up = async (e) => {
    const files = [...e.target.files]; setBusy(true); setErr('');
    try {
      const urls = [];
      for (const f of files) { const fd = new FormData(); fd.append('file', await compressImage(f), 'photo.jpg'); fd.append('folder', folder); urls.push((await api('/api/admin/upload', { method: 'POST', body: fd })).url); }
      onChange(single ? urls.slice(-1) : [...value, ...urls]);
    } catch (x) { setErr(x.message); }
    setBusy(false); e.target.value = '';
  };
  return (
    <div>
      <div className="photos">{value.map((u) => <div key={u}><img className="thumbimg" src={u} alt="" /><button type="button" onClick={() => onChange(value.filter((x) => x !== u))} aria-label="Remove photo">×</button></div>)}</div>
      <input type="file" accept="image/*" multiple={!single} onChange={up} disabled={busy} />
      {busy && <p className="note">Uploading…</p>}{err && <p className="err">{err}</p>}
    </div>
  );
}

const L3 = [['en', 'English'], ['am', 'Amharic'], ['om', 'Afaan Oromo']];
const blank = { name: { en: '', am: '', om: '' }, description: { en: '', am: '', om: '' }, price_per_night: '', capacity: 2, amenities: [], photos: [], active: true };

function Types() {
  const [list, setList] = useState([]), [edit, setEdit] = useState(null), [err, setErr] = useState('');
  const load = useCallback(async () => { try { setList((await api('/api/admin/room-types')).types); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (e) => {
    e.preventDefault(); setErr('');
    try { await api(edit.id ? `/api/admin/room-types/${edit.id}` : '/api/admin/room-types', { method: edit.id ? 'PUT' : 'POST', body: edit }); setEdit(null); load(); } catch (x) { setErr(x.message); }
  };
  const del = async (t) => { if (!window.confirm('Delete this room type?')) return; try { await api(`/api/admin/room-types/${t.id}`, { method: 'DELETE' }); load(); } catch (x) { setErr(x.message); } };
  const toggle = async (t) => { try { await api(`/api/admin/room-types/${t.id}`, { method: 'PUT', body: { ...t, active: !t.active } }); load(); } catch (x) { setErr(x.message); } };
  if (edit) {
    const nest = (k, l) => (e) => setEdit({ ...edit, [k]: { ...edit[k], [l]: e.target.value } });
    return (
      <form className="card" onSubmit={save}>
        <h3 style={{ marginBottom: 14 }}>{edit.id ? 'Edit room type' : 'New room type'}</h3>
        <div className="grid2">{L3.map(([l, n]) => <div className="field" key={l}><label>Name ({n})</label><input value={edit.name[l] || ''} onChange={nest('name', l)} required={l === 'en'} /></div>)}</div>
        <div className="grid2">{L3.map(([l, n]) => <div className="field" key={l}><label>Description ({n})</label><textarea value={edit.description[l] || ''} onChange={nest('description', l)} /></div>)}</div>
        <div className="grid2">
          <div className="field"><label>Price per night (ETB)</label><input type="number" min="0" step="1" required value={edit.price_per_night} onChange={(e) => setEdit({ ...edit, price_per_night: e.target.value })} /></div>
          <div className="field"><label>Max guests</label><input type="number" min="1" required value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /></div>
        </div>
        <div className="field"><label>Amenities (comma separated, e.g. Wi-Fi, Hot shower, Breakfast)</label><input value={edit.amenities.join(', ')} onChange={(e) => setEdit({ ...edit, amenities: e.target.value.split(',').map((x) => x.trimStart()) })} /></div>
        <div className="field"><label>Photos (first photo is the main one)</label><Photos value={edit.photos} onChange={(p) => setEdit({ ...edit, photos: p })} /></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}><input type="checkbox" style={{ width: 'auto' }} checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Show on website</label>
        {err && <p className="err">{err}</p>}
        <div className="pillrow"><button className="btn gold">Save</button><button type="button" className="btn ghost" onClick={() => { setEdit(null); setErr(''); }}>Back</button></div>
      </form>
    );
  }
  return (
    <>
      <button className="btn gold" onClick={() => setEdit(blank)}>Add room type</button>
      {err && <p className="err">{err}</p>}
      <div className="scroll" style={{ marginTop: 14 }}><table className="tbl"><thead><tr><th>Photo</th><th>Name</th><th>Price</th><th>Guests</th><th>Shown</th><th /></tr></thead><tbody>
        {list.map((t) => (
          <tr key={t.id}><td>{t.photos[0] ? <img className="thumbimg" src={t.photos[0]} alt="" /> : '—'}</td><td>{t.name.en}</td><td>{money(t.price_per_night)}</td><td>{t.capacity}</td><td>{t.active ? 'Yes' : 'Hidden'}</td>
            <td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => setEdit({ ...blank, ...t, amenities: t.amenities || [], photos: t.photos || [] })}>Edit</button>{' '}
              <button className="btn sm ghost" onClick={() => toggle(t)}>{t.active ? 'Hide' : 'Show'}</button>{' '}<button className="btn sm danger" onClick={() => del(t)}>Delete</button></td></tr>))}
      </tbody></table></div>
    </>
  );
}

function Rooms() {
  const [rooms, setRooms] = useState([]), [types, setTypes] = useState([]), [num, setNum] = useState(''), [tid, setTid] = useState(''), [err, setErr] = useState('');
  const load = useCallback(async () => { try { const [a, b] = await Promise.all([api('/api/admin/rooms'), api('/api/admin/room-types')]); setRooms(a.rooms); setTypes(b.types); if (!tid && b.types[0]) setTid(b.types[0].id); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const add = async (e) => { e.preventDefault(); setErr(''); try { await api('/api/admin/rooms', { method: 'POST', body: { number: num, room_type_id: tid } }); setNum(''); load(); } catch (x) { setErr(x.message); } };
  const upd = async (r, body) => { try { await api(`/api/admin/rooms/${r.id}`, { method: 'PUT', body }); load(); } catch (x) { setErr(x.message); } };
  const del = async (r) => { if (!window.confirm(`Delete room ${r.number}?`)) return; try { await api(`/api/admin/rooms/${r.id}`, { method: 'DELETE' }); load(); } catch (x) { setErr(x.message); } };
  return (
    <>
      <p className="note">Each physical room is one row here. Guests book a room type; the system gives them any free room of that type.</p>
      <form className="inline" onSubmit={add}>
        <div className="field"><label>Room number</label><input required value={num} onChange={(e) => setNum(e.target.value)} placeholder="101" /></div>
        <div className="field"><label>Room type</label><select value={tid} onChange={(e) => setTid(e.target.value)}>{types.map((t) => <option key={t.id} value={t.id}>{t.name.en}</option>)}</select></div>
        <button className="btn gold" disabled={!tid}>Add room</button>
      </form>
      {types.length === 0 && <p className="muted">Create a room type first.</p>}
      {err && <p className="err">{err}</p>}
      <div className="scroll" style={{ marginTop: 14 }}><table className="tbl"><thead><tr><th>Room</th><th>Type</th><th>In service</th><th /></tr></thead><tbody>
        {rooms.map((r) => (
          <tr key={r.id}><td><b>{r.number}</b></td>
            <td><select value={r.room_type_id} onChange={(e) => upd(r, { room_type_id: e.target.value })}>{types.map((t) => <option key={t.id} value={t.id}>{t.name.en}</option>)}</select></td>
            <td><button className="btn sm ghost" onClick={() => upd(r, { active: !r.active })}>{r.active ? 'Yes (turn off)' : 'Off (turn on)'}</button></td>
            <td><button className="btn sm danger" onClick={() => del(r)}>Delete</button></td></tr>))}
      </tbody></table></div>
    </>
  );
}

function Settings() {
  const [s, setS] = useState(null), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  useEffect(() => { api('/api/settings').then(setS).catch((e) => setErr(e.message)); }, []);
  if (!s) return <p>{err || 'Loading…'}</p>;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    try { await api('/api/admin/settings', { method: 'PUT', body: s }); setMsg('Saved. Reload the website to see the changes.'); } catch (x) { setErr(x.message); }
  };
  const F = ({ k, label, type = 'text', ...p }) => <div className="field"><label>{label}</label><input type={type} value={s[k] ?? ''} onChange={set(k)} {...p} /></div>;
  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ marginBottom: 14 }}>Guest house</h3>
      <div className="grid2"><F k="name" label="Name" required /><F k="tagline" label="Tagline" /><F k="phone" label="Phone (shown on the site, used for Call to book)" /><F k="email" label="Contact email" /></div>
      <F k="address" label="Address" /><F k="map_url" label="Google Maps embed link (Share → Embed a map → copy the src address)" />
      <div className="field"><label>Home page photo</label><Photos value={s.hero_image ? [s.hero_image] : []} folder="site" single onChange={(a) => setS({ ...s, hero_image: a[0] || '' })} /></div>
      <h3 style={{ margin: '18px 0 14px' }}>Look</h3>
      <div className="grid2"><F k="brand_color" label="Main color" type="color" /><F k="accent_color" label="Accent color" type="color" /></div>
      <h3 style={{ margin: '18px 0 14px' }}>Stay and payment rules</h3>
      <div className="grid2">
        <F k="check_in_time" label="Check-in time" type="time" /><F k="check_out_time" label="Check-out time" type="time" />
        <F k="hold_minutes" label="Minutes to hold an unpaid room" type="number" min="1" max="60" />
        <F k="refund_percent" label="Refund percent" type="number" min="0" max="100" />
        <F k="refund_hours" label="Refund only if cancelled this many hours before check-in" type="number" min="0" />
      </div>
      {err && <p className="err">{err}</p>}{msg && <p className="ok">{msg}</p>}
      <button className="btn gold">Save settings</button>
    </form>
  );
}

function Staff() {
  const [list, setList] = useState([]), [f, setF] = useState({ name: '', email: '', password: '', role: 'receptionist' }), [err, setErr] = useState('');
  const load = useCallback(async () => { try { setList((await api('/api/admin/staff')).staff); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const add = async (e) => { e.preventDefault(); setErr(''); try { await api('/api/admin/staff', { method: 'POST', body: f }); setF({ name: '', email: '', password: '', role: 'receptionist' }); load(); } catch (x) { setErr(x.message); } };
  const upd = async (s, body) => { try { await api(`/api/admin/staff/${s.id}`, { method: 'PUT', body }); load(); } catch (x) { setErr(x.message); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <form className="inline" onSubmit={add}>
        <div className="field"><label>Name</label><input required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Email</label><input type="email" required value={f.email} onChange={set('email')} /></div>
        <div className="field"><label>Password (8+ characters)</label><input type="password" required minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" /></div>
        <div className="field"><label>Role</label><select value={f.role} onChange={set('role')}><option value="receptionist">Receptionist</option><option value="admin">Admin</option></select></div>
        <button className="btn gold">Add staff</button>
      </form>
      {err && <p className="err">{err}</p>}
      <div className="scroll" style={{ marginTop: 14 }}><table className="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th /></tr></thead><tbody>
        {list.map((s) => (
          <tr key={s.id}><td>{s.name}</td><td>{s.email}</td><td>{s.role}</td><td>{s.active ? 'Yes' : 'No'}</td>
            <td style={{ whiteSpace: 'nowrap' }}><button className="btn sm ghost" onClick={() => upd(s, { active: !s.active })}>{s.active ? 'Deactivate' : 'Activate'}</button>{' '}
              <button className="btn sm ghost" onClick={() => { const p = window.prompt('New password (8+ characters):'); if (p) upd(s, { password: p }); }}>Reset password</button></td></tr>))}
      </tbody></table></div>
    </>
  );
}

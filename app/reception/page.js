'use client';
import { useCallback, useEffect, useState } from 'react';
import StaffShell from '@/components/StaffShell';
import QrScanner from '@/components/QrScanner';
import { api, money, fmtDate, addDays, todayStr } from '@/lib/client';

const METHODS = [['cash', 'Cash'], ['telebirr', 'Telebirr'], ['bank_transfer', 'Bank transfer'], ['pos', 'POS card'], ['pay_at_checkin', 'Pay at check-in']];
const nightsOf = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export default function Reception() { return <StaffShell>{(staff) => <Desk staff={staff} />}</StaffShell>; }

function Desk({ staff }) {
  const [ov, setOv] = useState(null), [from, setFrom] = useState(todayStr()), [err, setErr] = useState('');
  const [ci, setCi] = useState(todayStr()), [co, setCo] = useState(addDays(todayStr(), 1)), [free, setFree] = useState(null);
  const [draft, setDraft] = useState(null), [sel, setSel] = useState(null);
  const [scan, setScan] = useState(false), [code, setCode] = useState(''), [vr, setVr] = useState(null);
  const load = useCallback(async () => { try { setOv(await api(`/api/staff/overview?from=${from}&days=14`)); } catch (e) { setErr(e.message); } }, [from]);
  useEffect(() => { load(); }, [load]);
  const check = async (e) => {
    e?.preventDefault(); setErr('');
    try { setFree((await api(`/api/staff/free-rooms?in=${ci}&out=${co}`)).rooms); } catch (x) { setErr(x.message); setFree(null); }
  };
  const act = async (b, action) => {
    let refundAmount;
    if (action === 'cancel') {
      if (b.status === 'confirmed') {
        const v = window.prompt(`Refund amount in ETB (0 for none). The policy suggests ${b.suggested_refund}:`, String(b.suggested_refund));
        if (v === null) return; refundAmount = Number(v);
      } else if (!window.confirm('Cancel this?')) return;
    }
    try { await api(`/api/staff/bookings/${b.id}`, { method: 'PATCH', body: { action, refundAmount } }); setSel(null); load(); if (free) check(); }
    catch (x) { setErr(x.message); }
  };
  const verify = async (c) => {
    setErr(''); setVr(null);
    try { setVr(await api('/api/staff/verify', { method: 'POST', body: { code: c } })); } catch (x) { setErr(x.message); }
  };
  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i));
  const cell = (room, day) => ov.bookings.find((b) => b.room_id === room.id && b.check_in <= day && day < b.check_out);
  const List = ({ rows, action, label }) => rows.length === 0 ? <p className="muted">Nobody today.</p> : (
    <table className="tbl"><tbody>{rows.map((b) => (
      <tr key={b.id}><td><b>{b.guest_name}</b><br /><span className="muted">{b.guest_phone}</span></td><td>Room {b.rooms?.number}</td>
        <td>{b.payment_method === 'pay_at_checkin' ? 'Collect ' + money(b.total) : 'Paid'}</td>
        <td style={{ textAlign: 'right' }}><button className="btn sm" onClick={() => act(b, action)}>{label}</button></td></tr>))}</tbody></table>
  );

  return (
    <>
      {err && <p className="err">{err}</p>}
      <h2 style={{ marginTop: 4 }}>Verify guest QR code</h2>
      <form className="inline" onSubmit={(e) => { e.preventDefault(); if (code.trim()) verify(code.trim()); }}>
        <button type="button" className="btn gold" onClick={() => setScan(true)}>Scan QR with camera</button>
        <div className="field" style={{ flex: 2 }}><label>Or type the code or booking reference</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EK1A2B3C4D.xxxxxxxxxxxx" autoCapitalize="characters" /></div>
        <button className="btn">Verify</button>
      </form>
      {vr && (() => {
        const tone = vr.verdict === 'ok' ? 'var(--ok)' : vr.verdict === 'early' ? 'var(--warn)' : 'var(--danger)';
        const b = vr.booking;
        return (
          <div className="card" style={{ borderColor: tone, borderWidth: 2, marginTop: 12 }}>
            <h3 style={{ color: tone }}>{vr.verdict === 'ok' ? '✔ ' : vr.verdict === 'early' ? '! ' : '✖ '}{vr.message}</h3>
            {b && <>
              <p style={{ margin: '12px 0 4px' }}><b style={{ fontSize: 20 }}>{b.guest_name}</b> · {b.guest_phone}</p>
              <p className="muted" style={{ margin: 0 }}>{b.reference} · Room <b>{b.rooms?.number}</b> ({b.room_types?.name?.en}) · {b.guests} guest(s)</p>
              <p>{fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.nights} night(s)</p>
              <p>{b.payment_method === 'pay_at_checkin' ? <b style={{ color: 'var(--warn)' }}>Collect {money(b.total)} from the guest now</b> : <>Paid {money(b.total)} ({(b.payment_method || '').replace('_', ' ')})</>}</p>
              {vr.manual && <p className="note">Typed by hand, not scanned.</p>}
            </>}
            <div className="pillrow">
              {b && b.status === 'confirmed' && ['ok', 'early'].includes(vr.verdict) && (
                <button className="btn gold" onClick={async () => {
                  if (vr.verdict === 'early' && !window.confirm('The check-in date is not today. Check in anyway?')) return;
                  await act(b, 'check_in'); verify(code || b.reference);
                }}>{vr.verdict === 'early' ? 'Check in anyway' : 'Check in guest'}</button>)}
              <button className="btn ghost" onClick={() => { setVr(null); setCode(''); }}>Clear</button>
            </div>
          </div>);
      })()}

      {!ov ? <p>Loading…</p> : <>
        <h2>Today · {fmtDate(ov.today)}</h2>
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div><h3 style={{ fontSize: 18, marginBottom: 8 }}>Arrivals</h3><List rows={ov.arrivals} action="check_in" label="Check in" /></div>
          <div><h3 style={{ fontSize: 18, marginBottom: 8 }}>Departures</h3><List rows={ov.departures} action="check_out" label="Check out" /></div>
        </div>

        <h2>Check availability and book</h2>
        <form className="inline" onSubmit={check}>
          <div className="field"><label>Check-in</label><input type="date" min={todayStr()} value={ci} onChange={(e) => { setCi(e.target.value); if (co <= e.target.value) setCo(addDays(e.target.value, 1)); }} /></div>
          <div className="field"><label>Check-out</label><input type="date" min={addDays(ci, 1)} value={co} onChange={(e) => setCo(e.target.value)} /></div>
          <button className="btn">Show free rooms</button>
        </form>
        {free && (free.length === 0 ? <p>No rooms are free for these dates.</p> : (
          <div className="scroll"><table className="tbl" style={{ marginTop: 12 }}><thead><tr><th>Room</th><th>Type</th><th>Per night</th><th>Total</th><th /></tr></thead><tbody>
            {free.map((r) => (
              <tr key={r.id}><td><b>{r.number}</b></td><td>{r.room_types.name.en}</td><td>{money(r.room_types.price_per_night)}</td>
                <td>{money(r.room_types.price_per_night * nightsOf(ci, co))}</td>
                <td style={{ textAlign: 'right' }}><button className="btn sm gold" onClick={() => setDraft({ roomId: r.id, number: r.number, typeName: r.room_types.name.en, price: r.room_types.price_per_night, checkIn: ci, checkOut: co })}>Book</button></td></tr>))}
          </tbody></table></div>))}

        <h2>Calendar</h2>
        <div className="inline" style={{ marginBottom: 10 }}>
          <button className="btn sm ghost" onClick={() => setFrom(addDays(from, -7))}>← Earlier</button>
          <button className="btn sm ghost" onClick={() => setFrom(todayStr())}>Today</button>
          <button className="btn sm ghost" onClick={() => setFrom(addDays(from, 7))}>Later →</button>
          <span className="note" style={{ alignSelf: 'center' }}>Green confirmed · Dark green checked in · Amber awaiting payment · Grey blocked</span>
        </div>
        <div className="scroll"><table className="cal"><thead><tr><th>Room</th>{days.map((d) => <th key={d}>{d.slice(5)}</th>)}</tr></thead><tbody>
          {ov.rooms.map((r) => (
            <tr key={r.id}><td className="rn">{r.number} <span className="muted" style={{ fontWeight: 400 }}>{r.room_types?.name?.en}</span></td>
              {days.map((d) => { const b = cell(r, d); return b
                ? <td key={d} className={'b ' + b.status} title={`${b.guest_name} (${b.check_in} → ${b.check_out})`} onClick={() => setSel(b)}>{b.check_in === d || d === from ? b.guest_name : ''}</td>
                : <td key={d} onClick={() => setDraft({ roomId: r.id, number: r.number, typeName: r.room_types?.name?.en, price: null, checkIn: d, checkOut: addDays(d, 1) })} style={{ cursor: 'pointer' }} title="Free" />; })}
            </tr>))}
        </tbody></table></div>
      </>}

      {scan && <QrScanner onCode={(c) => { setScan(false); setCode(c); verify(c); }} onClose={() => setScan(false)} />}
      {draft && <BookForm draft={draft} staff={staff} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); if (free) check(); }} />}
      {sel && (
        <div className="modal" onClick={() => setSel(null)}><div className="card" onClick={(e) => e.stopPropagation()}>
          <h3>{sel.guest_name}</h3>
          <p className="muted">{sel.reference} · Room {sel.rooms?.number} · {sel.status.replace('_', ' ')}</p>
          <p>{fmtDate(sel.check_in)} → {fmtDate(sel.check_out)}<br />{sel.guest_phone}<br />Total {money(sel.total)} · {(sel.payment_method || '').replace('_', ' ')} {sel.payment_reference || ''}</p>
          <div className="pillrow">
            {sel.status === 'confirmed' && <button className="btn sm" onClick={() => act(sel, 'check_in')}>Check in</button>}
            {sel.status === 'checked_in' && <button className="btn sm" onClick={() => act(sel, 'check_out')}>Check out</button>}
            {['confirmed', 'pending', 'blocked'].includes(sel.status) && (sel.status !== 'blocked' || staff.role === 'admin') && <button className="btn sm danger" onClick={() => act(sel, 'cancel')}>{sel.status === 'blocked' ? 'Unblock' : 'Cancel booking'}</button>}
            <button className="btn sm ghost" onClick={() => setSel(null)}>Close</button>
          </div>
        </div></div>)}
    </>
  );
}

function BookForm({ draft, staff, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', guests: 1, paymentMethod: 'cash', paymentReference: '', notes: '', block: false, checkIn: draft.checkIn, checkOut: draft.checkOut });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const n = nightsOf(f.checkIn, f.checkOut);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/staff/bookings', { method: 'POST', body: { ...f, roomId: draft.roomId } }); onSaved(); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="modal" onClick={onClose}><form className="card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
      <h3 style={{ marginBottom: 4 }}>Room {draft.number}</h3>
      <p className="muted" style={{ marginTop: 0 }}>{draft.typeName}{draft.price ? ` · ${money(draft.price)} per night` : ''}</p>
      <div className="inline">
        <div className="field"><label>Check-in</label><input type="date" min={todayStr()} value={f.checkIn} onChange={set('checkIn')} /></div>
        <div className="field"><label>Check-out</label><input type="date" min={addDays(f.checkIn, 1)} value={f.checkOut} onChange={set('checkOut')} /></div>
      </div>
      {draft.price && n > 0 && <p><b>Total: {money(draft.price * n)}</b> for {n} night{n > 1 ? 's' : ''}</p>}
      {staff.role === 'admin' && <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.block} onChange={set('block')} /> Block this room (maintenance, not a guest)</label>}
      {!f.block && <>
        <div className="field"><label>Guest name</label><input required value={f.name} onChange={set('name')} /></div>
        <div className="inline">
          <div className="field"><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
          <div className="field"><label>Guests</label><input type="number" min="1" value={f.guests} onChange={set('guests')} /></div>
        </div>
        <div className="field"><label>Email (optional, sends confirmation)</label><input type="email" value={f.email} onChange={set('email')} /></div>
        <div className="inline">
          <div className="field"><label>Payment</label><select value={f.paymentMethod} onChange={set('paymentMethod')}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="field"><label>Receipt / transaction no.</label><input value={f.paymentReference} onChange={set('paymentReference')} /></div>
        </div>
      </>}
      <div className="field"><label>Notes</label><textarea value={f.notes} onChange={set('notes')} style={{ minHeight: 60 }} /></div>
      {err && <p className="err">{err}</p>}
      <div className="pillrow"><button className="btn gold" disabled={busy}>{f.block ? 'Block room' : 'Confirm booking'}</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button></div>
    </form></div>
  );
}

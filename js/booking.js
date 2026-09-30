(() => {
  const f = document.getElementById('booking-form');
  const $ = s => document.querySelector(s);
  const err = $('#error'), sum = $('#summary');
  let rooms = [];
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  f.checkin.min = today;
  const nights = () => (f.checkin.value && f.checkout.value) ? Math.round((Date.parse(f.checkout.value) - Date.parse(f.checkin.value)) / 864e5) : 0;

  async function load() {
    const q = nights() > 0 ? `?checkin=${f.checkin.value}&checkout=${f.checkout.value}` : '';
    const d = await (await fetch('/api/rooms' + q)).json();
    rooms = d.rooms;
    $('#cin').textContent = d.settings.checkin_time; $('#cout').textContent = d.settings.checkout_time; $('#hold').textContent = d.hold;
    const want = f.room_id.value || (new URLSearchParams(location.search).get('room') || '').replace(/\+/g, ' ');
    f.room_id.innerHTML = '<option value="">Select a room</option>' + rooms.map(r => {
      const off = r.price <= 0 || r.free === 0;
      return `<option value="${r.id}" ${off ? 'disabled' : ''}>${r.name}${r.price > 0 ? ' - ' + r.price.toLocaleString() + ' ETB/night' : ''}${off ? (r.price > 0 ? ' (sold out)' : ' (call to book)') : ''}</option>`;
    }).join('');
    const m = rooms.find(r => String(r.id) === want || r.name === want);
    if (m && !f.room_id.querySelector(`option[value="${m.id}"]`).disabled) f.room_id.value = m.id;
    total();
  }
  function total() {
    const r = rooms.find(x => String(x.id) === f.room_id.value), n = nights();
    sum.textContent = r && n > 0 ? `${n} night${n > 1 ? 's' : ''} x ${r.price.toLocaleString()} = ${(n * r.price).toLocaleString()} ETB` : '';
  }
  f.checkin.addEventListener('change', () => { f.checkout.min = f.checkin.value; if (nights() <= 0) f.checkout.value = ''; load(); });
  f.checkout.addEventListener('change', load);
  f.room_id.addEventListener('change', total);

  f.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = '';
    const btn = f.querySelector('.submit-btn'); btn.disabled = true; btn.textContent = 'Please wait...';
    try {
      const r = await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      location.href = d.checkout_url;
    } catch (x) { err.textContent = x.message || 'Something went wrong.'; btn.disabled = false; btn.textContent = 'Pay with Chapa'; load(); }
  });
  load();
})();

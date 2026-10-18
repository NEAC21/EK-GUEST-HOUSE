'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { api, todayStr, addDays } from '@/lib/client';
import { parseMap } from '@/lib/map';

function Gallery({ photos, alt, empty }) {
  const [i, setI] = useState(0);
  if (!photos?.length) return <div className="ph" title={empty}>{(alt || '?')[0]}</div>;
  return (
    <div className="gal">
      <img src={photos[i]} alt={alt} loading="lazy" />
      {photos.length > 1 && (
        <div className="thumbs">
          {photos.map((p, k) => (
            <button key={p} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Photo ${k + 1}`}><img src={p} alt="" /></button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { t, tr, settings } = useApp();
  const [inD, setIn] = useState(''), [outD, setOut] = useState(''), [guests, setGuests] = useState(2);
  const [types, setTypes] = useState(null), [searched, setSearched] = useState(false), [err, setErr] = useState('');
  const today = todayStr();
  const map = parseMap(settings.map_url, settings.address);
  const load = async (q = '') => { try { setTypes((await api('/api/availability' + q)).types); } catch (e) { setErr(e.message); } };
  useEffect(() => { load(); }, []);
  const search = async (e) => {
    e.preventDefault(); setErr('');
    if (!inD || !outD || outD <= inD) { setErr(t('pick_dates')); return; }
    await load(`?in=${inD}&out=${outD}&guests=${guests}`); setSearched(true);
    document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' });
  };
  const onIn = (v) => { setIn(v); if (!outD || outD <= v) setOut(addDays(v, 1)); };
  const bg = settings.hero_image ? { backgroundImage: `url(${settings.hero_image})` } : undefined;

  return (
    <>
      <section className="hero" style={bg}>
        <div className="wrap">
          <h1>{settings.name}</h1>
          <p>{settings.tagline}</p>
          <form className="dock" onSubmit={search}>
            <div><label htmlFor="ci">{t('check_in')}</label><input id="ci" type="date" min={today} value={inD} onChange={(e) => onIn(e.target.value)} /></div>
            <div><label htmlFor="co">{t('check_out')}</label><input id="co" type="date" min={inD ? addDays(inD, 1) : today} value={outD} onChange={(e) => setOut(e.target.value)} /></div>
            <div><label htmlFor="gs">{t('guests')}</label>
              <select id="gs" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></div>
            <button className="btn gold">{t('search')}</button>
          </form>
        </div>
      </section>
      <div className="dock-gap" />
      <div className="wrap">
        {err && <p className="err">{err}</p>}
        <section id="rooms" className="sec" style={{ paddingTop: 24 }}>
          <h2>{t('rooms_title')}</h2>
          {!types && <p className="muted">{t('loading')}</p>}
          {types && searched && !types.some((x) => x.available > 0) && <p>{t('no_rooms')}</p>}
          <div className="rooms">
            {(types || []).map((r) => {
              const n = r.available;
              const q = `?type=${r.id}&in=${inD}&out=${outD}&guests=${guests}`;
              return (
                <article className="room" key={r.id}>
                  <Gallery photos={r.photos} alt={tr(r.name)} empty={t('no_photo')} />
                  <div className="body">
                    <h3>{tr(r.name)}</h3>
                    <p className="muted" style={{ margin: 0 }}>{tr(r.description)}</p>
                    <div className="chips">
                      <span className="chip">{t('capacity', { n: r.capacity })}</span>
                      {(r.amenities || []).map((a) => <span className="chip" key={a}>{a}</span>)}
                    </div>
                    <div className="row">
                      <div className="price"><small>{t('from')} </small>{Number(r.price_per_night).toLocaleString()} ETB <small>{t('per_night')}</small></div>
                      {searched && n !== null && (n > 0
                        ? <span className={'tag' + (n <= 2 ? ' low' : '')}>{t('left', { n })}</span>
                        : <span className="tag out">{t('sold_out')}</span>)}
                    </div>
                    {searched && n > 0
                      ? <Link className="btn" href={'/book' + q}>{t('book_now')}</Link>
                      : !searched ? <a className="btn ghost" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); document.getElementById('ci')?.focus(); }}>{t('pick_dates')}</a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <section id="contact" className="sec">
          <h2>{t('contact_title')}</h2>
          <div className="contact">
            <div className="card">
              {settings.address && <p style={{ marginTop: 0 }}>{settings.address}</p>}
              {settings.phone && <p><a className="btn gold" href={`tel:${settings.phone}`}>{t('call_us')}: {settings.phone}</a></p>}
              {settings.email && <p><a href={`mailto:${settings.email}`}>{settings.email}</a></p>}
              <p className="note">{settings.check_in_time} / {settings.check_out_time}</p>
            </div>
            {map && (
              <div>
                {map.embed && <iframe src={map.embed} loading="lazy" title="Map" />}
                {map.open && <p><a className="btn ghost" href={map.open} target="_blank" rel="noopener noreferrer">{t('directions')}</a></p>}
              </div>)}
          </div>
        </section>
      </div>
    </>
  );
}

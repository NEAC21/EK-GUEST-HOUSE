'use client';
import Link from 'next/link';
import { useApp } from './AppProvider';
export function LangSwitch() {
  const { lang, setLang } = useApp();
  return (
    <div className="lang" role="group" aria-label="Language">
      {[['en', 'EN'], ['am', 'አማ'], ['om', 'OM']].map(([k, l]) => (
        <button key={k} className={lang === k ? 'on' : ''} onClick={() => setLang(k)} aria-pressed={lang === k}>{l}</button>
      ))}
    </div>
  );
}
export default function SiteChrome({ children }) {
  const { t, settings } = useApp();
  return (
    <>
      <header className="hdr"><div className="wrap">
        <Link href="/" className="logo">{settings.name}</Link>
        <nav className="nav">
          <Link href="/#rooms">{t('nav_rooms')}</Link>
          <Link href="/#contact">{t('nav_contact')}</Link>
          <Link href="/booking">{t('nav_booking')}</Link>
          <LangSwitch />
        </nav>
      </div></header>
      {children}
      <footer className="ftr"><div className="wrap">© {new Date().getFullYear()} {settings.name}. {t('footer_rights')}</div></footer>
    </>
  );
}

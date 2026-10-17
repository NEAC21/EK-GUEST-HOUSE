'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { DICT } from '@/lib/i18n';
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
export function AppProvider({ settings, children }) {
  const [lang, setLangState] = useState('en');
  useEffect(() => { const l = localStorage.getItem('lang'); if (l && DICT[l]) setLangState(l); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l) => { setLangState(l); localStorage.setItem('lang', l); };
  const t = (k, v = {}) => {
    let s = (DICT[lang] && DICT[lang][k]) || DICT.en[k] || k;
    for (const x in v) s = s.split(`{${x}}`).join(String(v[x]));
    return s;
  };
  const tr = (o) => (o && (o[lang] || o.en)) || '';
  return <Ctx.Provider value={{ lang, setLang, t, tr, settings }}>{children}</Ctx.Provider>;
}

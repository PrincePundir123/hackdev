import { useSyncExternalStore } from 'react';
import english from './locales/en.json';
import languages from '../shared/languages.json';

export { languages };
const keys = Object.keys(english);
const index = new Map(keys.map((key, i) => [key, i]));
const loaders = import.meta.glob<{ default: string[] }>(['./locales/*.json', '!./locales/en.json']);
const resources = new Map<string, string[]>();
const listeners = new Set<() => void>();
let language = 'en';
let revision = 0;
let request = 0;
export const getLanguage = () => language;
export const locale = () => (language === 'en' ? 'en-IN' : language);
export const pluralSuffix = (count: number) => (language === 'en' && count !== 1 ? 's' : '');
export function useLanguage() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getLanguage);
}
export async function prepareLanguage(code: string) {
  if (code === 'en' || resources.has(code)) return;
  if (!languages.some((entry) => entry.code === code && entry.available))
    throw new Error('Language is not available yet.');
  const load = loaders[`./locales/${code}.json`];
  if (!load) throw new Error('Language is not available yet.');
  const values = (await load()).default;
  if (values.length !== keys.length) throw new Error('Language file is incomplete.');
  resources.set(code, values);
}
export async function setLanguage(code: string) {
  const pending = ++request;
  await prepareLanguage(code);
  if (pending !== request) return;
  language = code;
  localStorage.setItem('saathi:language', code);
  const entry = languages.find((item) => item.code === code)!;
  document.documentElement.lang = code;
  document.documentElement.dir = entry.dir;
  revision++;
  listeners.forEach((listener) => listener());
}
export const languageRevision = () => revision;
export function t(source: string, params: Record<string, unknown> = {}) {
  const position = index.get(source);
  const optional: Record<string, string> = {
    hi: '(वैकल्पिक)',
    mr: '(ऐच्छिक)',
    bn: '(ঐচ্ছিক)',
    ne: '(ऐच्छिक)',
    ur: '(اختیاری)',
    sa: '(वैकल्पिकम्)',
    ta: '(விருப்பத்தேர்வு)',
    te: '(ఐచ్ఛికం)',
    kn: '(ಐಚ್ಛಿಕ)',
    gu: '(વૈકલ્પિક)',
    pa: '(ਵਿਕਲਪਿਕ)',
    ml: '(ഐച്ഛികം)',
    as: '(ঐচ্ছিক)',
    or: '(ବୈକଳ୍ପିକ)',
  };
  const value =
    source === '(optional)'
      ? optional[language] || source
      : position === undefined
        ? source
        : resources.get(language)?.[position] || source;
  return value.replace(/\{\{(\w+)\}\}/g, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token,
  );
}
// Apply only to app-generated copy. Personal titles, names, notes and outcomes never pass here.
const templates = keys
  .filter(
    (key) =>
      key.includes('{{p') &&
      key.endsWith('.') &&
      !key.startsWith('{{p0}},') &&
      !key.startsWith('You interpret') &&
      !key.includes('\n'),
  )
  .map((key) => {
    const names: string[] = [];
    const pattern = key
      .split(/(\{\{p\d+\}\})/g)
      .map((part) => {
        if (/^\{\{p\d+\}\}$/.test(part)) {
          names.push(part.slice(2, -2));
          return '([\\s\\S]*?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return { key, names, pattern: new RegExp(`^${pattern}$`) };
  })
  .sort((a, b) => b.key.length - a.key.length);
export function systemText(source: string) {
  if (index.has(source)) return t(source);
  for (const template of templates) {
    const match = template.pattern.exec(source);
    if (match)
      return t(
        template.key,
        Object.fromEntries(template.names.map((name, i) => [name, match[i + 1]])),
      );
  }
  return source;
}

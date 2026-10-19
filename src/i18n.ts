import { useSyncExternalStore } from 'react';
import english from './locales/en.json';
import languages from '../shared/languages.json';

export { languages };
const keys = Object.keys(english);
const sourceKeys = new Set(keys);
const loaders = import.meta.glob<{ default: Record<string, string> }>([
  './locales/*.json',
  '!./locales/en.json',
]);
const resources = new Map<string, Record<string, string>>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
let language = 'en';
let request = 0;
export const getLanguage = () => language;
export const locale = () => (language === 'en' ? 'en-IN' : language);
export const pluralSuffix = (count: number) => (language === 'en' && count !== 1 ? 's' : '');
export function formatDate(timestamp: number, options: Intl.DateTimeFormatOptions) {
  const supported = Intl.DateTimeFormat.supportedLocalesOf(locale()).length > 0;
  const localizedOptions = {
    ...options,
    ...(language !== 'en' && options.hour ? { hour12: false } : {}),
  };
  const adjusted: Intl.DateTimeFormatOptions = supported
    ? localizedOptions
    : {
        ...localizedOptions,
        weekday: undefined,
        ...(options.month ? { month: '2-digit' } : {}),
        ...(options.hour ? { hour12: false } : {}),
      };
  const result = new Intl.DateTimeFormat(supported ? locale() : 'en-IN', adjusted).format(
    timestamp,
  );
  if (!supported && options.weekday) {
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: options.timeZone,
    }).format(timestamp);
    return `${t(weekday)} ${result}`;
  }
  return result;
}
export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage);
}
export async function prepareLanguage(code: string) {
  if (code === 'en' || resources.has(code)) return;
  if (!languages.some((entry) => entry.code === code && entry.available))
    throw new Error('Language is not available yet.');
  const load = loaders[`./locales/${code}.json`];
  if (!load) throw new Error('Language is not available yet.');
  const values = (await load()).default;
  if (keys.some((key) => typeof values[key] !== 'string' || !values[key].trim()))
    throw new Error('Language file is incomplete.');
  resources.set(code, values);
}
export async function setLanguage(code: string) {
  const pending = ++request;
  await prepareLanguage(code);
  if (pending !== request) return;
  language = code;
  try {
    localStorage.setItem('saathi:language', code);
  } catch {
    /* Account preference still works if device storage is disabled. */
  }
  const entry = languages.find((item) => item.code === code)!;
  document.documentElement.lang = code;
  document.documentElement.dir = entry.dir;
  listeners.forEach((listener) => listener());
}
export function t(source: string, params: Record<string, unknown> = {}) {
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
      : resources.get(language)?.[source] || source;
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
  if (sourceKeys.has(source)) return t(source);
  const legacyDisclosure =
    /^A (permitted detailed|minimal) request was placed in (.+)'s inbox\.$/.exec(source);
  if (legacyDisclosure)
    return t(
      legacyDisclosure[1] === 'minimal'
        ? 'A minimal request was placed in {{p0}}’s inbox.'
        : 'A permitted detailed request was placed in {{p0}}’s inbox.',
      { p0: legacyDisclosure[2] },
    );
  const action = /^Request action recorded: (accept|decline|resolve|cancel)\.$/.exec(source);
  if (action)
    return t('Request action recorded: {{p0}}.', {
      p0: t(action[1][0].toUpperCase() + action[1].slice(1)),
    });
  const scheduled =
    /^(\d+) otherwise eligible contacts? (?:is|are) outside scheduled hours and will not be invited now\.$/.exec(
      source,
    );
  if (scheduled)
    return +scheduled[1] === 1
      ? t('One otherwise eligible contact is outside scheduled hours and will not be invited now.')
      : t(
          '{{p0}} otherwise eligible contacts are outside scheduled hours and will not be invited now.',
          { p0: scheduled[1] },
        );
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
export function errorText(source: string) {
  const translated = systemText(source);
  // Unknown provider/browser/schema diagnostics are not a regional translation.
  return language !== 'en' && translated === source && /[A-Za-z]/.test(source)
    ? t('Something went wrong. Please try again.')
    : translated;
}

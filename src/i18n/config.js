import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import english from '../locales/en/translation.json' with { type: 'json' };

export const LANGUAGE_STORAGE_KEY = 'escam.language';
export const LANGUAGES = [{ code: 'en', label: 'English', short: 'EN' }, { code: 'fil', label: 'Filipino', short: 'FIL' }, { code: 'war', label: 'Waray-Waray — Boronganon', short: 'WAR' }];
const supported = new Set(LANGUAGES.map(item => item.code));
// Vite serves JSON imports as JavaScript modules during development. Browser
// JSON import assertions reject that MIME type. Node's direct tests still need
// the assertion; production bundling resolves the asserted imports normally.
const loaders = import.meta.env?.DEV
  ? { fil: () => import('../locales/fil/translation.json'), war: () => import('../locales/war/translation.json') }
  : { fil: () => import('../locales/fil/translation.json', { with: { type: 'json' } }), war: () => import('../locales/war/translation.json', { with: { type: 'json' } }) };
const canonical = new Map(Object.keys(english).map(key => [key.toLowerCase(), key]));
const storedMessages = new Map();
i18n.use(initReactI18next).init({
  lng: 'en', fallbackLng: 'en', supportedLngs: [...supported],
  resources: { en: { translation: english } },
  keySeparator: false, nsSeparator: false, initAsync: false,
  interpolation: { escapeValue: false }, react: { useSuspense: false },
  returnNull: false, returnEmptyString: false,
});

// English phrases are stable catalog keys and readable fallback values. Never
// apply this to resident content: callers explicitly select interface labels.
export function t(message, values = {}) {
  if (Array.isArray(message)) return message.map(part => t(part, values)).join(' ');
  if (typeof message !== 'string' || !message) return message;
  const previous = storedMessages.get(message);
  const key = previous?.key || (Object.hasOwn(english, message) ? message : canonical.get(message.toLowerCase()) || message);
  const parameters = previous ? { ...previous.values, ...values } : values;
  const result = i18n.t(key, { defaultValue: message, ...parameters });
  if (Object.hasOwn(english, key) && (result !== key || Object.keys(parameters).length)) {
    storedMessages.set(result, { key, values: parameters });
    if (storedMessages.size > 2000) storedMessages.delete(storedMessages.keys().next().value);
  }
  return result;
}
export function readLanguage(storage) {
  try { const value = (storage ?? globalThis.localStorage)?.getItem(LANGUAGE_STORAGE_KEY); return supported.has(value) ? value : 'en'; } catch { return 'en'; }
}
let requested = 0;
export async function changeLanguage(language) {
  const code = supported.has(language) ? language : 'en';
  const generation = ++requested;
  if (loaders[code] && !i18n.hasResourceBundle(code, 'translation')) {
    const resource = await loaders[code]();
    i18n.addResourceBundle(code, 'translation', resource.default);
  }
  if (generation !== requested) return;
  await i18n.changeLanguage(code);
  try { globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, code); } catch { /* Still usable when storage is blocked. */ }
  if (globalThis.document) document.documentElement.lang = code;
}
export const initializeLanguage = () => changeLanguage(readLanguage());
export const languageCode = () => i18n.language;
// Browsers generally lack Waray CLDR data. Filipino provides the shared
// Philippine month vocabulary instead of silently falling back to US formats.
export const locale = () => i18n.language === 'en' ? 'en-PH' : 'fil-PH';
export const formatNumber = value => new Intl.NumberFormat(locale()).format(value);
export const formatDate = (value, options = {}) => new Intl.DateTimeFormat(locale(), { timeZone: 'Asia/Manila', ...options }).format(new Date(value));
export default i18n;

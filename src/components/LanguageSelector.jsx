import { useState } from 'react';
import { ChevronDown, Globe2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, changeLanguage, t } from '../i18n/config.js';

export default function LanguageSelector({ compact = false }) {
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  async function select(event) {
    setLoading(true); setFailed(false);
    try { await changeLanguage(event.target.value); } catch { setFailed(true); }
    finally { setLoading(false); }
  }
  return <div className={`language-control${compact ? ' is-compact' : ''}`}>
    <label className="language-selector"><Globe2 className="language-globe" size={16} aria-hidden="true" />
      <span className="sr-only">{t('Language')}</span>
      <select aria-label={t('Language')} value={i18n.language} onChange={select} disabled={loading}>
        {LANGUAGES.map(language => <option key={language.code} value={language.code} lang={language.code}>{language.label}</option>)}
      </select>
      {compact && <span className="language-code" aria-hidden="true">{LANGUAGES.find(language => language.code === i18n.language)?.short || 'EN'}</span>}
      <ChevronDown className="language-chevron" size={13} aria-hidden="true" />
    </label>
    {failed && <span className="language-error" role="alert">{t('Language could not be loaded. Please try again.')}</span>}
  </div>;
}

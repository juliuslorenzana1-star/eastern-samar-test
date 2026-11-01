import { t } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { formatStatus } from '../lib/reports.js';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useDialogFocus from '../lib/useDialogFocus.js';
import { categoryVisual } from '../lib/place.js';

export default function CategorySheet({ categories, counts, category, theme, onApply, onClose, filters, onFilters, municipalities = [], statuses = [] }) {
  useTranslation();
  const [draftFilters, setDraftFilters] = useState(filters);
  const [draft, setDraft] = useState(category);
  const ref = useDialogFocus({ onClose });
  return createPortal(<div className="category-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="category-sheet" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="category-sheet-title">
      <header><div><span className="eyebrow">{t("EXPLORE COMMUNITY CONCERNS")}</span><h2 id="category-sheet-title">{t("Filter community map")}</h2></div><button className="icon-button" onClick={onClose} aria-label={t("Close map filters")}><X size={20} /></button></header>
      <p>{t("Select one category, or explore all concerns. Counts follow your other report filters.")}</p>
      <div className="map-filter-body">
      {draftFilters && <div className="map-filter-fields">
        <label>{t("Search reports or places")}<input value={draftFilters.query} onChange={e => setDraftFilters({...draftFilters, query:e.target.value})} /></label>
        <label>{t("Municipality")}<select value={draftFilters.area} onChange={e => setDraftFilters({...draftFilters, area:e.target.value})}><option value="all">{t("All municipalities")}</option>{municipalities.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <label>{t("Status")}<select value={draftFilters.status} onChange={e => setDraftFilters({...draftFilters, status:e.target.value})}><option value="all">{t("All statuses")}</option>{statuses.map(name => <option key={name} value={name}>{formatStatus(name)}</option>)}</select></label>
        <label>{t("Date")}<select value={draftFilters.dateRange} onChange={e => setDraftFilters({...draftFilters, dateRange:e.target.value})}><option value="all">{t("Any time")}</option>{[7,30,90].map(days => <option key={days} value={days}>{t("Past")} {days}  {t("days")}</option>)}</select></label>
      </div>}
      <div className="category-sheet-options" role="group" aria-label={t("Choose a concern category")}>
        <button aria-pressed={draft === 'all'} onClick={() => setDraft('all')}><span>{t("All categories")}</span></button>
        {categories.map((item) => {
          const { color, glyph } = categoryVisual(item.slug, theme);
          return <button key={item.slug} aria-pressed={draft === item.slug} onClick={() => setDraft(draft === item.slug ? 'all' : item.slug)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ color }}>{glyph.map((d) => <path d={d} key={d} />)}</svg><span>{t(item.name)}</span><b>{counts.get(item.slug) ?? 0}</b>
          </button>;
        })}
        {!categories.length && <p>{t("Categories will appear when the shared category list is available.")}</p>}
      </div>
      </div>
      <footer><button className="outline-button" onClick={() => { setDraft('all'); setDraftFilters({query:'', area:'all', status:'all', dateRange:'all'}); }}>{t("Clear filters")}</button><button className="primary-button" onClick={() => { onApply(draft); if (draftFilters) onFilters?.(draftFilters); onClose(); }}>{t("Apply filters")}</button></footer>
    </section>
  </div>, document.body);
}

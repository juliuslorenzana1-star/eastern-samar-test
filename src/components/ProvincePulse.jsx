import { t } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { Activity, Building2, CalendarDays, Crosshair, MapPin, ShieldCheck, ThumbsUp } from 'lucide-react';
import { categoryVisual } from '../lib/place.js';
import { useState } from 'react';

function Tile({ icon: Icon, value, suffix, label, tone = 'green' }) {
  useTranslation();
  return (
    <div className="pulse-tile">
      <span className={`pulse-icon ${tone}`}><Icon size={15} /></span>
      <span className="pulse-copy">
        <strong>{value}{suffix && <small>{suffix}</small>}</strong>
        <span>{t(label)}</span>
      </span>
    </div>
  );
}

// Province pulse: every figure here is counted from reports already loaded for
// this session. Public viewers only ever see approved reports, so review-stage
// numbers can never leak into the public figures.
export default function ProvincePulse({
  reports, theme, categories, coverage, counts, isStaff, pending, verified, resolved,
  thisWeek, barangays, municipalityTotal, category, area, onSelectCategory, onSelectPlace,
}) {
  useTranslation();
  const activeMunicipalities = coverage.filter((entry) => entry.count > 0);
  const idleCount = municipalityTotal - activeMunicipalities.length;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pulse" id="community-impact" role="region" aria-label={t("Community pulse statistics")} tabIndex={0}>
      <header className="pulse-header">
        <div>
          <span className="eyebrow">{t("EASTERN SAMAR")}</span>
          <h3>{area === "all" ? t("Community pulse") : area}</h3>
        </div>
        <span className="pulse-header-meta">{t("Published reports · current area, search, status and date filters")}</span>
      </header>

      <section className="pulse-grid" aria-label={t("Province summary")}>
        <Tile icon={Activity} value={reports.length} label="Published reports" tone="orange" />
        <Tile icon={Building2} value={activeMunicipalities.length} suffix={` / ${municipalityTotal}`} label="Municipalities reached" tone="green" />
        <Tile icon={ThumbsUp} value={resolved} label="Resolved" tone="green" />
        {expanded && <><Tile icon={MapPin} value={barangays} label="Barangays named" tone="blue" /><Tile icon={ShieldCheck} value={isStaff ? pending : verified} label={isStaff ? 'Awaiting review' : 'Verified actions'} tone="violet" />
        <Tile icon={CalendarDays} value={thisWeek} label="Filed this week" tone="blue" /></>}
      </section>

      <p className="pulse-note">{t("Counts reflect published reports loaded for this session and the current area, search, status and date filters. Private submissions are excluded.")}</p>
      <button className="pulse-expand" aria-expanded={expanded} aria-controls="pulse-extra-details" onClick={() => setExpanded((value) => !value)}>{expanded ? t("Fewer community insights") : t("More community insights")}</button>
      <details id="pulse-extra-details" className="pulse-details" open hidden={!expanded}>
      <summary>{t("Categories and municipality coverage")}</summary>
      <section className="pulse-block" aria-label={t("Reports by category")}>
        <header className="pulse-block-head"><span>{t("Concern categories")}</span><small>{t("Select a category to filter the map")}</small></header>
        <div className="pulse-chips">
          {categories.map((item) => {
            const { color } = categoryVisual(item.slug, theme);
            const count = counts.get(item.slug) ?? 0;
            const active = category === item.slug;
            return (
              <button
                type="button"
                key={item.slug}
                className={`pulse-chip${active ? ' is-active' : ''}${count ? '' : ' is-empty'}`}
                style={{ '--marker-color': color }}
                onClick={() => onSelectCategory(active ? 'all' : item.slug)}
                aria-pressed={active}
              >
                <i className="pulse-chip-mark" />
                <span>{t(item.name)}</span>
                <b>{count}</b>
              </button>
            );
          })}
        </div>
      </section>

      <section className="pulse-block" aria-label={t("Municipality coverage")}>
        <header className="pulse-block-head"><span>{t("Municipalities with activity")}</span><small>{activeMunicipalities.length}  {t("of")} {municipalityTotal}</small></header>
        {activeMunicipalities.length ? (
          <ul className="pulse-coverage">
            {activeMunicipalities.map((entry) => (
              <li key={entry.municipality}>
                <button
                  type="button"
                  className={`coverage-row${area === entry.municipality ? ' is-active' : ''}`}
                  onClick={() => onSelectPlace({ municipality: entry.municipality, focus: entry.focus })}
                  disabled={!entry.focus}
                  title={entry.focus ? t("Centre the map on {{value1}}", { value1: entry.municipality }) : t("No mapped points yet")}
                >
                  <span className="coverage-name">{entry.municipality}</span>
                  <span className="coverage-meta">
                    {entry.count} {entry.count === 1 ? t("action") : t("actions")}
                    {entry.barangays.length ? ` · ${entry.barangays.length} ${entry.barangays.length === 1 ? t("barangay") : t("barangays")}` : ''}
                  </span>
                  <span className="coverage-go"><Crosshair size={13} /></span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="pulse-note">{t("No approved community actions on the map yet. Municipalities appear here as reports are reviewed and published.")}</p>}
        {idleCount > 0 && <p className="pulse-note">{idleCount} {idleCount === 1 ? t("municipality has") : t("municipalities have")}  {t("no published action yet.")}</p>}
      </section>
      </details>
    </div>
  );
}

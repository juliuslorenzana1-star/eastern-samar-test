import { Activity, Building2, CalendarDays, Crosshair, MapPin, ShieldCheck, ThumbsUp } from 'lucide-react';
import { categoryVisual } from '../lib/place.js';

function Tile({ icon: Icon, value, suffix, label, tone = 'green' }) {
  return (
    <div className="pulse-tile">
      <span className={`pulse-icon ${tone}`}><Icon size={15} /></span>
      <span className="pulse-copy">
        <strong>{value}{suffix && <small>{suffix}</small>}</strong>
        <span>{label}</span>
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
  const activeMunicipalities = coverage.filter((entry) => entry.count > 0);
  const idleCount = municipalityTotal - activeMunicipalities.length;

  return (
    <div className="pulse">
      <header className="pulse-header">
        <div>
          <span className="eyebrow">EASTERN SAMAR</span>
          <h3>Community pulse</h3>
        </div>
        <span className="pulse-header-meta">Local action across the province</span>
      </header>

      <section className="pulse-grid" aria-label="Province summary">
        <Tile icon={Activity} value={reports.length} label="Community actions" tone="orange" />
        <Tile icon={Building2} value={activeMunicipalities.length} suffix={` / ${municipalityTotal}`} label="Municipalities reached" tone="green" />
        <Tile icon={MapPin} value={barangays} label="Barangays named" tone="blue" />
        <Tile icon={ShieldCheck} value={isStaff ? pending : verified} label={isStaff ? 'Awaiting review' : 'Verified actions'} tone="violet" />
        <Tile icon={ThumbsUp} value={resolved} label="Resolved" tone="green" />
        <Tile icon={CalendarDays} value={thisWeek} label="Filed this week" tone="blue" />
      </section>

      <section className="pulse-block" aria-label="Reports by category">
        <header className="pulse-block-head"><span>Concern categories</span><small>Select a category to filter the map</small></header>
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
                <span>{item.name}</span>
                <b>{count}</b>
              </button>
            );
          })}
        </div>
      </section>

      <section className="pulse-block" aria-label="Municipality coverage">
        <header className="pulse-block-head"><span>Municipalities with activity</span><small>{activeMunicipalities.length} of {municipalityTotal}</small></header>
        {activeMunicipalities.length ? (
          <ul className="pulse-coverage">
            {activeMunicipalities.map((entry) => (
              <li key={entry.municipality}>
                <button
                  type="button"
                  className={`coverage-row${area === entry.municipality ? ' is-active' : ''}`}
                  onClick={() => onSelectPlace({ municipality: entry.municipality, focus: entry.focus })}
                  disabled={!entry.focus}
                  title={entry.focus ? `Centre the map on ${entry.municipality}` : 'No mapped points yet'}
                >
                  <span className="coverage-name">{entry.municipality}</span>
                  <span className="coverage-meta">
                    {entry.count} {entry.count === 1 ? 'action' : 'actions'}
                    {entry.barangays.length ? ` · ${entry.barangays.length} ${entry.barangays.length === 1 ? 'barangay' : 'barangays'}` : ''}
                  </span>
                  <span className="coverage-go"><Crosshair size={13} /></span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="pulse-note">No approved community actions on the map yet. Municipalities appear here as reports are reviewed and published.</p>}
        {idleCount > 0 && <p className="pulse-note">{idleCount} {idleCount === 1 ? 'municipality has' : 'municipalities have'} no published action yet.</p>}
      </section>
    </div>
  );
}

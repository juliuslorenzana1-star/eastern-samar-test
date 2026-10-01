import { CalendarClock, Clock3, Crosshair, MapPin, X } from 'lucide-react';
import { formatStatus } from '../lib/reports.js';
import { PROVINCE, isReviewed, provinceContext } from '../lib/place.js';

const priorityLabels = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };

function dayValue(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// The information panel for a selected marker. Every line comes from columns
// already returned by src/lib/reports.js — nothing is invented here.
export default function ReportDetailCard({ report, categoryName, markerColor, statusColorValue, decision, onClose }) {
  if (!report) return null;
  const trail = provinceContext(report);
  const reviewed = isReviewed(report.status);
  const coordinates = Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude))
    ? `${Number(report.latitude).toFixed(4)}, ${Number(report.longitude).toFixed(4)}`
    : 'No map point yet';

  return (
    <aside className="detail-card" aria-label="Community report details">
      <div className="detail-topline">
        <span className="detail-category" style={{ '--marker-color': markerColor }}>
          <i className="detail-category-mark" />
          {categoryName ?? report.category_slug}
        </span>
        <button className="icon-button detail-close" onClick={onClose} aria-label="Close details" type="button"><X size={17} /></button>
      </div>

      <h3 className="detail-title">{report.title}</h3>

      <nav className="detail-trail" aria-label="Location context">
        {trail.map((part, index) => (
          <span key={part} className={index === 0 ? 'is-province' : undefined}>
            {index > 0 && <span className="detail-trail-sep" aria-hidden="true">/</span>}
            {index === 0 ? <MapPin size={11} /> : null}
            {part}
          </span>
        ))}
      </nav>

      <div className="detail-status-row">
        <span className="status-pill" style={{ '--status-color': statusColorValue }}><i className="status-dot" />{formatStatus(report.status)}</span>
        <span className={`detail-review-tag${reviewed ? ' is-reviewed' : ''}`}>
          {reviewed ? 'Reviewed by a moderator' : 'Awaiting review · not yet confirmed'}
        </span>
      </div>

      <p className="detail-description">{report.description}</p>

      <dl className="detail-facts">
        <div><dt>Urgency</dt><dd>{priorityLabels[report.priority] ?? report.priority}</dd></div>
        <div><dt>Submitted</dt><dd>{dayValue(report.created_at) ?? '—'}</dd></div>
        {report.incident_at && <div><dt>Incident date</dt><dd>{dayValue(report.incident_at)}</dd></div>}
        {report.needed_by && <div><dt>Needed by</dt><dd><CalendarClock size={11} /> {dayValue(`${report.needed_by}T12:00:00`)}</dd></div>}
        {report.verified_at && <div><dt>Verified</dt><dd>{dayValue(report.verified_at)}</dd></div>}
        {report.resolved_at && <div><dt>Resolved</dt><dd><Clock3 size={11} /> {dayValue(report.resolved_at)}</dd></div>}
        <div><dt>Public map point</dt><dd><Crosshair size={11} /> {coordinates}</dd></div>
      </dl>

      {decision && <p className="report-decision">{decision}</p>}

      <div className="detail-foot">
        <span>{PROVINCE.name} · community submission</span>
        <small>{report.id.slice(0, 8)}</small>
      </div>
    </aside>
  );
}

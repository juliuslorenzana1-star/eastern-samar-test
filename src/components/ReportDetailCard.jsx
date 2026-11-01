import { t, locale } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Clock3, Crosshair, MapPin, X } from 'lucide-react';
import { formatStatus } from '../lib/reports.js';
import { PROVINCE, isReviewed, provinceContext } from '../lib/place.js';
import { hasCoordinates } from '../lib/place.js';
import { reportLifecycle } from '../lib/report-validation.js';
import ReportProgress from './ReportProgress.jsx';

const priorityLabels = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };

function dayValue(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

// The information panel for a selected marker. Every line comes from columns
// already returned by src/lib/reports.js — nothing is invented here.
export default function ReportDetailCard({ report, categoryName, markerColor, statusColorValue, decision, canViewEvidence = false, onClose }) {
  useTranslation();
  if (!report) return null;
  const trail = provinceContext(report);
  const reviewed = isReviewed(report.status);
  const lifecycle = reportLifecycle(report);
  const coordinates = hasCoordinates(report)
    ? `${Number(report.latitude).toFixed(4)}, ${Number(report.longitude).toFixed(4)}`
    : 'No map point yet';

  return (
    <aside className="detail-card" aria-label={t("Community report details")}>
      <div className="detail-topline">
        <span className="detail-category" style={{ '--marker-color': markerColor }}>
          <i className="detail-category-mark" />
          {t(categoryName ?? report.category_slug)}
        </span>
        <button className="icon-button detail-close" onClick={onClose} aria-label={t("Close details")} type="button"><X size={17} /></button>
      </div>

      <h3 className="detail-title">{report.title}</h3>

      <nav className="detail-trail" aria-label={t("Location context")}>
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
          {reviewed ? t("Reviewed by a moderator") : t("Awaiting review · not yet confirmed")}
        </span>
      </div>

      <p className="detail-description">{report.description}</p>

      <dl className="detail-facts">
        <div><dt>{t("Verification")}</dt><dd>{formatStatus(lifecycle.verification)}</dd></div>
        <div><dt>{t("Resolution")}</dt><dd>{formatStatus(lifecycle.resolution)}</dd></div>
        <div><dt>{t("Urgency")}</dt><dd>{t(priorityLabels[report.priority] ?? report.priority)}</dd></div>
        <div><dt>{t("Submitted")}</dt><dd>{dayValue(report.created_at) ?? '—'}</dd></div>
        {report.incident_at && <div><dt>{t("Incident date")}</dt><dd>{dayValue(report.incident_at)}</dd></div>}
        {report.needed_by && <div><dt>{t("Needed by")}</dt><dd><CalendarClock size={11} /> {dayValue(`${report.needed_by}T12:00:00`)}</dd></div>}
        {report.verified_at && <div><dt>{t("Verified")}</dt><dd>{dayValue(report.verified_at)}</dd></div>}
        {report.resolved_at && <div><dt>{t("Resolved")}</dt><dd><Clock3 size={11} /> {dayValue(report.resolved_at)}</dd></div>}
        <div><dt>{t("Public map point")}</dt><dd><Crosshair size={11} /> {t(coordinates)}</dd></div>
      </dl>

      {decision && <p className="report-decision">{decision}</p>}
      <ReportProgress key={report.id} report={report} canViewEvidence={canViewEvidence} />

      <div className="detail-foot">
        <span>{PROVINCE.name}  {t("· community submission")}</span>
        <small>{report.id.slice(0, 8)}</small>
      </div>
    </aside>
  );
}

import { t, locale } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MapPin, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import PlatformStatistics from './PlatformStatistics.jsx';
import { privacyPolicy } from '../lib/privacy-policy.js';

export default function CivicOverview({ reports, activities, staff, onReport, onMap, onVolunteer }) {
  useTranslation();
  const [now] = useState(() => Date.now());
  const upcoming = activities.filter((activity) => ['published', 'active', 'open'].includes(activity.status) && Date.parse(activity.starts_at) > now).slice(0, 3);
  return <section className="civic-overview" aria-label={t("Community participation")}>
    <div className="civic-actions">
      <button className="primary-button" onClick={onReport}>{t("Report a Concern")} <ArrowRight size={16} /></button>
      <button className="outline-button" onClick={onMap}><MapPin size={16} />{t("Explore Community Map")}</button>
      <button className="outline-button" onClick={onVolunteer}><Users size={16} />{t("Join Volunteer Activities")}</button>
    </div>
    <PlatformStatistics key={String(staff)} staff={staff} refreshKey={reports.length} />
    <details className="civic-guide"><summary>{t("How it works · reporting, volunteering and transparency")}</summary>
      <div className="civic-columns">
        <article><h2>{t("Raise a concern")}</h2><p>{t("Sign in, describe what needs attention and choose an optional map point. Your submission stays private during review.")}</p></article>
        <article><h2>{t("Follow the review")}</h2><p>{t("Moderators check submissions before publication. Verification and resolution are separate steps. Track your concern under My submissions.")}</p></article>
        <article><h2>{t("Take part locally")}</h2><p>{t("Join an open activity and track your registration. Authorized staff confirm attendance and service hours. Public recognition is optional.")}</p></article>
      </div>
      <h2>{t("Featured verified concerns")}</h2>
      {reports.filter((report) => report.status === 'verified').slice(0, 3).map((report) => <p key={report.id}><strong>{report.title}</strong> · {report.municipality}</p>)}
      {!reports.some((report) => report.status === 'verified') && <p>{t("No verified concerns are currently loaded.")}</p>}
      <h2>{t("Upcoming activities")}</h2>
      {upcoming.length ? upcoming.map((activity) => <p key={activity.id}><strong>{activity.title}</strong> · {activity.municipality} · {new Date(activity.starts_at).toLocaleString(locale(), { timeZone: 'Asia/Manila' })}</p>) : <p>{t("No upcoming activities are currently loaded. Check the volunteer board for availability.")}</p>}
      <h2><ShieldCheck size={17} />  {t("Platform transparency")}</h2>
      <p>{t("Published counts come from database records loaded in this session. Private reports are excluded. This community platform does not claim government endorsement. Review decisions are made by authorized people; automated flags, when available, are advisory.")}</p>
    </details>
    <p className="emergency-disclaimer">{t("This platform is not a substitute for emergency services. Reports are not monitored as an emergency dispatch channel.")}</p>
    <p className="privacy-contact">{t('Privacy, correction, deletion and takedown requests:')} <a href={`mailto:${privacyPolicy.contact}`}>{privacyPolicy.contact}</a></p>
    <details className="civic-guide" id="privacy"><summary>{t("Privacy and reporting guidelines")}</summary><p>{t("Describe observable conditions. Do not include personal allegations, contact details, faces of vulnerable people, or information that could identify a victim. Only approved reports appear publicly. Exact map points, evidence and internal notes are restricted. Public map coordinates are approximate.")}</p><p>{t("Evidence stays private to its reporter and authorized staff. Signing out clears account views; offline drafts remain on this device until synced or deleted. Use a trusted device for sensitive drafts. Contact the platform operator about correction or deletion requests.")}</p><p>{t("Municipality boundaries are geographic reference data, not a legal survey. Barangay names are resident supplied unless explicitly identified as verified boundary data.")}</p></details>
  </section>;
}

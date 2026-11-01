import { t, locale } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import useDialogFocus from '../lib/useDialogFocus.js';
import AuditHistory from './AuditHistory.jsx';
import LanguageSelector from './LanguageSelector.jsx';
import { AlertTriangle, Check, Clock3, FileText, MapPin, Search, ShieldCheck, X } from 'lucide-react';
import { formatStatus, publicReportStatuses, reportPriorities, reportStatuses } from '../lib/reports.js';
import { MUNICIPALITIES } from '../lib/place.js';

const priorityLabels = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
const priorityColors = { low: '#71827c', normal: '#4d7f9d', high: '#bd7837', urgent: '#bd4d43' };
const volunteerCategories = [
  ['disaster-emergency', 'Disaster / Emergency'], ['infrastructure', 'Infrastructure'],
  ['environment', 'Environment'], ['public-safety', 'Public Safety'],
  ['health', 'Health & Services'], ['education', 'Education & Youth'], ['livelihood', 'Livelihood'],
];

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Metric({ label, value, icon: Icon, tone = 'green' }) {
  useTranslation();
  return <div className="review-metric"><span className={`review-metric-icon ${tone}`}><Icon size={16} /></span><span><strong>{value}</strong><small>{t(label)}</small></span></div>;
}

function ScreeningAdvisory({ loading, error, review }) {
  useTranslation();
  if (loading) return <p>{t("Loading screening record…")}</p>;
  if (error) return <p>{t("Screening status could not be loaded. Continue with human review.")}</p>;

  const flags = review?.flags ?? [];
  const status = review?.run?.status;
  const message = status === 'pending'
    ? 'Screening is still processing. Human review is required.'
    : status === 'unavailable'
      ? 'Screening was unavailable for this report. Human review is required.'
      : status === 'failed'
        ? 'Screening failed. Any saved flags remain advisory; human review is required.'
        : status === 'completed' && !flags.length
          ? 'Screening returned no flags. This does not verify the report.'
          : status === 'completed'
            ? 'Screening completed. Flags are advisory and do not verify the report.'
            : 'No screening record is available. Human review is required.';

  return <>
    <p>{t(message)}</p>
    {flags.length > 0 && <ul className="ai-review-flags">{flags.map((flag) => (
      <li key={flag.id}>
        <strong>{formatStatus(flag.flag_type)}</strong>
        {flag.confidence !== null && <small>{t("Model confidence estimate:")} {Math.round(flag.confidence * 100)}%</small>}
        <p>{flag.explanation}</p>
      </li>
    ))}</ul>}
  </>;
}

export default function ModeratorDashboard({ reports, initialReportId = null, categories, profiles, isAdmin, currentUserId, onModerate, onChangeRole, onLoadEvidence, onLoadAIReview, onCreateVolunteerOpportunity, onUpdateVolunteerOpportunity, onLoadVolunteerManagement, onLoadVolunteerRegistrations, onUpdateVolunteerRegistration, onUpdateVolunteerOpportunityStatus, onSetVolunteerRegistrationOpen }) {
  useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const initialReportRequest = useRef({ id: null, opened: false });
  const [nextStatus, setNextStatus] = useState('under_review');
  const [nextPriority, setNextPriority] = useState('normal');
  const [note, setNote] = useState('');
  const [residentNote, setResidentNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [aiReview, setAIReview] = useState(null);
  const [aiReviewLoading, setAIReviewLoading] = useState(false);
  const [aiReviewError, setAIReviewError] = useState(false);
  const [volunteerReportId, setVolunteerReportId] = useState('');
  const [volunteerTitle, setVolunteerTitle] = useState('');
  const [volunteerDescription, setVolunteerDescription] = useState('');
  const [volunteerStartsAt, setVolunteerStartsAt] = useState('');
  const [volunteerEndsAt, setVolunteerEndsAt] = useState('');
  const [volunteerCapacity, setVolunteerCapacity] = useState('');
  const [volunteerCategory, setVolunteerCategory] = useState('community-services');
  const [volunteerMunicipality, setVolunteerMunicipality] = useState('');
  const [volunteerBarangay, setVolunteerBarangay] = useState('');
  const [volunteerLocation, setVolunteerLocation] = useState('');
  const [volunteerLatitude, setVolunteerLatitude] = useState('');
  const [volunteerLongitude, setVolunteerLongitude] = useState('');
  const [volunteerSkills, setVolunteerSkills] = useState('');
  const [volunteerTasks, setVolunteerTasks] = useState('');
  const [volunteerWhatToBring, setVolunteerWhatToBring] = useState('');
  const [editingVolunteerOpportunity, setEditingVolunteerOpportunity] = useState(null);
  const [managedOpportunity, setManagedOpportunity] = useState(null);
  const [managedRegistrations, setManagedRegistrations] = useState([]);
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [managementBusy, setManagementBusy] = useState(false);
  const [managementMessage, setManagementMessage] = useState('');
  const [publishingOpportunity, setPublishingOpportunity] = useState(false);
  const [opportunityMessage, setOpportunityMessage] = useState('');
  const [volunteerOverview, setVolunteerOverview] = useState({ opportunities: [], signupCounts: {} });
  const [volunteerOverviewError, setVolunteerOverviewError] = useState(false);
  const [currentTime] = useState(() => Date.now());

  const reviewDialogRef = useDialogFocus({ active: Boolean(selected), busy, onClose: () => setSelected(null) });
  const volunteerManagerRef = useDialogFocus({ active: Boolean(managedOpportunity), busy: managementBusy, onClose: () => setManagedOpportunity(null) });

  useEffect(() => {
    let active = true;
    onLoadVolunteerManagement()
      .then((overview) => { if (active) setVolunteerOverview(overview); })
      .catch(() => { if (active) setVolunteerOverviewError(true); });
    return () => { active = false; };
  }, [onLoadVolunteerManagement]);

  const categoryNames = Object.fromEntries(categories.map((category) => [category.slug, category.name]));
  const eligibleReports = reports.filter((report) => report.is_public && publicReportStatuses.includes(report.status));
  const volunteerReport = eligibleReports.find((report) => report.id === volunteerReportId);
  const overdue = reports.filter((report) => report.needed_by && Date.parse(`${report.needed_by}T23:59:59`) < currentTime && !['resolved', 'rejected'].includes(report.status));
  const filtered = reports.filter((report) => {
    const text = `${report.title} ${report.description} ${report.municipality} ${report.barangay ?? ''}`.toLowerCase();
    return (statusFilter === 'all' || report.status === statusFilter)
      && (priorityFilter === 'all' || report.priority === priorityFilter)
      && text.includes(search.toLowerCase());
  });

  async function openReport(report) {
    setSelected(report);
    setNextStatus(report.status);
    setNextPriority(report.priority);
    setNote('');
    setResidentNote('');
    setMessage('');
    setEvidence([]);
    setAIReview(null);
    setAIReviewLoading(true);
    setAIReviewError(false);
    try {
      const files = await onLoadEvidence(report.id);
      setEvidence(files ?? []);
    } catch {
      setMessage('Evidence could not be loaded. Check storage permissions.');
    }
    try {
      setAIReview(await onLoadAIReview(report.id));
    } catch {
      setAIReviewError(true);
    } finally {
      setAIReviewLoading(false);
    }
  }

  const openInitialReport = useEffectEvent((reportId) => {
    if (initialReportRequest.current.id !== reportId || initialReportRequest.current.opened) return;
    const report = reports.find((item) => item.id === reportId);
    if (!report) return;
    initialReportRequest.current.opened = true;
    void openReport(report);
  });

  useEffect(() => {
    if (initialReportRequest.current.id !== initialReportId) {
      initialReportRequest.current = { id: initialReportId, opened: false };
    }
    if (!initialReportId || initialReportRequest.current.opened) return;
    // Cleanup cancels StrictMode's first setup. Refreshing the queue after a
    // saved review does not reopen a request that has already been handled.
    const timeout = setTimeout(() => openInitialReport(initialReportId), 0);
    return () => clearTimeout(timeout);
  }, [initialReportId, reports]);

  const needsResidentReason = nextStatus === 'rejected' || nextStatus === 'needs_more_information';

  async function publishVolunteerOpportunity(event) {
    event.preventDefault();
    const independent = volunteerReportId === 'standalone';
    if (!editingVolunteerOpportunity && !independent && !volunteerReport) {
      setOpportunityMessage('Choose an approved public report or a standalone activity.');
      return;
    }
    if (Boolean(volunteerLatitude) !== Boolean(volunteerLongitude)) {
      setOpportunityMessage('Enter both map coordinates or leave both blank.');
      return;
    }
    setPublishingOpportunity(true);
    setOpportunityMessage('');
    try {
      const values = {
        report: volunteerReport,
        title: volunteerTitle,
        description: volunteerDescription,
        startsAt: volunteerStartsAt ? new Date(volunteerStartsAt).toISOString() : null,
        endsAt: volunteerEndsAt ? new Date(volunteerEndsAt).toISOString() : null,
        capacity: volunteerCapacity || null,
        category: volunteerCategory,
        municipality: volunteerMunicipality || volunteerReport?.municipality || null,
        barangay: volunteerBarangay || null,
        location: volunteerLocation || null,
        latitude: volunteerLatitude ? Number(volunteerLatitude) : null,
        longitude: volunteerLongitude ? Number(volunteerLongitude) : null,
        skills: volunteerSkills.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
        tasks: volunteerTasks.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
        whatToBring: volunteerWhatToBring.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      };
      if (editingVolunteerOpportunity) await onUpdateVolunteerOpportunity(editingVolunteerOpportunity.id, values);
      else await onCreateVolunteerOpportunity(values);
      setVolunteerTitle('');
      setVolunteerDescription('');
      setVolunteerStartsAt('');
      setVolunteerEndsAt('');
      setVolunteerCapacity('');
      setVolunteerMunicipality('');
      setVolunteerBarangay('');
      setVolunteerLocation('');
      setVolunteerLatitude('');
      setVolunteerLongitude('');
      setVolunteerSkills('');
      setVolunteerTasks('');
      setVolunteerWhatToBring('');
      setVolunteerReportId('');
      setEditingVolunteerOpportunity(null);
      setOpportunityMessage(editingVolunteerOpportunity ? 'Activity details saved.' : 'Published. Residents can find this opportunity under Volunteers.');
      try {
        setVolunteerOverview(await onLoadVolunteerManagement());
        setVolunteerOverviewError(false);
      } catch {
        setVolunteerOverviewError(true);
      }
    } catch (error) {
      setOpportunityMessage(['42703', 'PGRST204'].includes(error.code)
        ? 'Apply the report-linked volunteer migration before publishing opportunities.'
        : 'Could not publish this opportunity. Check staff access and the volunteer migration.');
    } finally {
      setPublishingOpportunity(false);
    }
  }

  function editVolunteerOpportunity(opportunity) {
    setEditingVolunteerOpportunity(opportunity);
    setVolunteerReportId(opportunity.report_id || 'standalone');
    setVolunteerTitle(opportunity.title || '');
    setVolunteerDescription(opportunity.description || '');
    setVolunteerStartsAt(localDateTime(opportunity.starts_at));
    setVolunteerEndsAt(localDateTime(opportunity.ends_at));
    setVolunteerCapacity(opportunity.capacity ? String(opportunity.capacity) : '');
    setVolunteerCategory(opportunity.category || 'community-services');
    setVolunteerMunicipality(opportunity.municipality || '');
    setVolunteerBarangay(opportunity.barangay || '');
    setVolunteerLocation(opportunity.location || '');
    setVolunteerLatitude(opportunity.latitude === null ? '' : String(opportunity.latitude ?? ''));
    setVolunteerLongitude(opportunity.longitude === null ? '' : String(opportunity.longitude ?? ''));
    setVolunteerSkills((opportunity.skills ?? []).join('\n'));
    setVolunteerTasks((opportunity.tasks ?? []).join('\n'));
    setVolunteerWhatToBring((opportunity.what_to_bring ?? []).join('\n'));
    setOpportunityMessage('Editing this activity. Organizer and report linkage cannot be changed.');
    document.getElementById('volunteer-management-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function openVolunteerManagement(opportunity) {
    setManagedOpportunity(opportunity);
    setManagedRegistrations([]);
    setAttendanceDrafts({});
    setManagementMessage('');
    setManagementBusy(true);
    try {
      const registrations = await onLoadVolunteerRegistrations(opportunity.id);
      setManagedRegistrations(registrations);
      setAttendanceDrafts(Object.fromEntries(registrations.map((registration) => [registration.id, {
        status: registration.status,
        volunteerHours: registration.volunteer_hours ?? '',
      }])));
    } catch {
      setManagementMessage('Registered volunteers could not be loaded. Check the volunteer migration and staff access.');
    } finally {
      setManagementBusy(false);
    }
  }

  async function saveVolunteerAttendance(registration) {
    if (registration.volunteer_id === currentUserId) {
      setManagementMessage('Another staff member must verify your attendance and hours.');
      return;
    }
    const draft = attendanceDrafts[registration.id] ?? {};
    setManagementBusy(true);
    setManagementMessage('');
    try {
      await onUpdateVolunteerRegistration(registration.id, draft);
      setManagedRegistrations(await onLoadVolunteerRegistrations(managedOpportunity.id));
      setManagementMessage('Attendance and hours saved.');
    } catch (error) {
      setManagementMessage(error.message || 'Attendance could not be saved. Confirm your staff permissions.');
    } finally {
      setManagementBusy(false);
    }
  }

  async function changeVolunteerActivityStatus(opportunity, status) {
    setManagementBusy(true);
    setManagementMessage('');
    try {
      await onUpdateVolunteerOpportunityStatus(opportunity.id, status);
      setVolunteerOverview(await onLoadVolunteerManagement());
      setManagedOpportunity({ ...opportunity, status });
      setManagementMessage(t("Activity status changed to {{value1}}.", { value1: formatStatus(status) }));
    } catch (error) {
      setManagementMessage(error.message || 'Activity status could not be changed.');
    } finally {
      setManagementBusy(false);
    }
  }

  async function changeVolunteerRegistrationOpen(opportunity, registrationOpen) {
    setManagementBusy(true);
    setManagementMessage('');
    try {
      await onSetVolunteerRegistrationOpen(opportunity.id, registrationOpen);
      setVolunteerOverview(await onLoadVolunteerManagement());
      setManagedOpportunity({ ...opportunity, registration_open: registrationOpen });
      setManagementMessage(t("Registration {{value1}}.", { value1: registrationOpen ? 'opened' : 'closed' }));
    } catch (error) {
      setManagementMessage(error.message || 'Registration settings could not be updated.');
    } finally {
      setManagementBusy(false);
    }
  }

  async function saveReview(event) {
    event.preventDefault();
    if (!selected) return;
    if (needsResidentReason && !residentNote.trim()) {
      setMessage('A reason for the reporter is required when rejecting or requesting more information.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await onModerate({ reportId: selected.id, status: nextStatus, priority: nextPriority, note, residentNote });
      setMessage('Review decision saved.');
      setSelected(null);
    } catch (error) {
      setMessage(error.message || 'Could not save the review.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="review-dashboard" aria-labelledby="review-title">
    <div className="review-heading">
      <div><span className="eyebrow">{t("AUTHORIZED REVIEWERS")}</span><h1 id="review-title">{t("Moderation queue")}</h1><p>{t("Review private submissions before anything is published.")}</p></div>
      <span className="review-role"><ShieldCheck size={15} /> {isAdmin ? t("Administrator") : t("Moderator")}</span>
    </div>
    <div className="review-metrics">
      <Metric label="Total reports" value={reports.length} icon={FileText} />
      <Metric label="Pending review" value={reports.filter((report) => report.status === 'pending_review').length} icon={Clock3} tone="blue" />
      <Metric label="Under review" value={reports.filter((report) => report.status === 'under_review').length} icon={Search} tone="violet" />
      <Metric label="Urgent" value={reports.filter((report) => report.priority === 'urgent' && !['resolved', 'rejected'].includes(report.status)).length} icon={AlertTriangle} tone="orange" />
      <Metric label="Overdue" value={overdue.length} icon={Clock3} tone="red" />
      <Metric label="Verified" value={reports.filter((report) => report.status === 'verified').length} icon={ShieldCheck} />
    </div>
    <div className="review-toolbar">
      <label className="review-search"><Search size={15} /><input aria-label={t("Search reports")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search title, area, or details")} /></label>
      <label className="review-filter"><span>{t("Status")}</span><select aria-label={t("Filter by review status")} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{t("All statuses")}</option>{reportStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
      <label className="review-filter"><span>{t("Priority")}</span><select aria-label={t("Filter by priority")} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">{t("All priorities")}</option>{reportPriorities.map((priority) => <option key={priority} value={priority}>{t(priorityLabels[priority])}</option>)}</select></label>
    </div>
    <div className="review-table-wrap">
      <table className="review-table">
        <thead><tr><th scope="col">{t("Concern")}</th><th scope="col">{t("Location")}</th><th scope="col">{t("Status")}</th><th scope="col">{t("Priority")}</th><th scope="col">{t("Submitted")}</th><th scope="col">{t("Needed by")}</th></tr></thead>
        <tbody>{filtered.map((report) => <tr key={report.id} onClick={() => openReport(report)} tabIndex="0" onKeyDown={(event) => event.key === 'Enter' && openReport(report)}>
          <td><button className="review-report-title" onClick={(event) => { event.stopPropagation(); openReport(report); }}>{report.title}</button><small>{t(categoryNames[report.category_slug] ?? report.category_slug)}</small></td>
          <td>{report.barangay ? `${report.barangay}, ` : ''}{report.municipality}</td>
          <td><span className="review-status">{formatStatus(report.status)}</span></td>
          <td><span className="review-priority" style={{ '--priority-color': priorityColors[report.priority] }}>{t(priorityLabels[report.priority])}</span></td>
          <td>{new Date(report.created_at).toLocaleDateString(locale())}</td>
          <td>{report.needed_by ? new Date(`${report.needed_by}T12:00:00`).toLocaleDateString(locale()) : '—'}</td>
        </tr>)}</tbody>
      </table>
      {!filtered.length && <div className="review-empty"><FileText size={21} /><strong>{t("No reports match")}</strong><span>{t("Try another filter. New submissions will appear here.")}</span></div>}
    </div>
    <section className="volunteer-management" aria-labelledby="volunteer-management-title">
      <div className="volunteer-management-heading"><span className="eyebrow">{t("AUTHORIZED COORDINATION")}</span><h2 id="volunteer-management-title">{editingVolunteerOpportunity ? t("Edit volunteer activity") : t("Create a volunteer activity")}</h2><p>{t("Publish a standalone community activity or connect it to an approved public report.")}</p></div>
      <form className="volunteer-create-form" onSubmit={publishVolunteerOpportunity}>
        <label className="field-label">{t("Community report")} <span className="optional-label">{t("Optional")}</span>
          <select required value={volunteerReportId} disabled={Boolean(editingVolunteerOpportunity)} onChange={(event) => setVolunteerReportId(event.target.value)}>
            <option value="">{t("Choose a public report or standalone activity")}</option>
            <option value="standalone">{t("Standalone community activity")}</option>
            {eligibleReports.map((report) => <option value={report.id} key={report.id}>{report.title} · {report.municipality}</option>)}
          </select>
        </label>
        <div className="volunteer-organizer-fields">
          <label className="field-label">{t("Activity category")} <select value={volunteerCategory} onChange={(event) => setVolunteerCategory(event.target.value)}>{volunteerCategories.map(([slug, label]) => <option key={slug} value={slug}>{t(label)}</option>)}</select>
          </label>
          <label className="field-label">{t("Municipality")} <select required={!volunteerReport} value={volunteerMunicipality || volunteerReport?.municipality || ''} onChange={(event) => setVolunteerMunicipality(event.target.value)}><option value="">{t("Choose municipality")}</option>{MUNICIPALITIES.map((place) => <option key={place}>{place}</option>)}</select>
          </label>
          <label className="field-label">{t("Barangay")} <span className="optional-label">{t("Optional")}</span><input maxLength="100" value={volunteerBarangay} onChange={(event) => setVolunteerBarangay(event.target.value)} placeholder={t("Activity barangay")} /></label>
          <label className="field-label">{t("Specific location")} <span className="optional-label">{t("Optional")}</span><input maxLength="180" value={volunteerLocation} onChange={(event) => setVolunteerLocation(event.target.value)} placeholder={t("Landmark, covered court, coastal site…")} /></label>
          <label className="field-label">{t("Map latitude")} <span className="optional-label">{t("Optional")}</span><input type="number" min="10.53" max="12.51" step="any" value={volunteerLatitude} onChange={(event) => setVolunteerLatitude(event.target.value)} placeholder="10.53–12.51" /></label>
          <label className="field-label">{t("Map longitude")} <span className="optional-label">{t("Optional")}</span><input type="number" min="124.95" max="126.13" step="any" value={volunteerLongitude} onChange={(event) => setVolunteerLongitude(event.target.value)} placeholder="124.95–126.13" /></label>
        </div>
        <label className="field-label">{t("Opportunity title")} <input required minLength="4" maxLength="160" value={volunteerTitle} onChange={(event) => setVolunteerTitle(event.target.value)} placeholder={t("What help is needed?")} />
        </label>
        <label className="field-label">{t("Volunteer activity")} <textarea required minLength="12" maxLength="4000" rows="3" value={volunteerDescription} onChange={(event) => setVolunteerDescription(event.target.value)} placeholder={t("Describe the activity and how volunteers can help.")} />
        </label>
        <div className="volunteer-organizer-fields">
          <label className="field-label">{t("Useful skills")} <span className="optional-label">{t("Optional · one per line")}</span><textarea rows="2" value={volunteerSkills} onChange={(event) => setVolunteerSkills(event.target.value)} placeholder={t("General Volunteer&#10;First Aid")} /></label>
          <label className="field-label">{t("Volunteer tasks")} <span className="optional-label">{t("Optional · one per line")}</span><textarea rows="2" value={volunteerTasks} onChange={(event) => setVolunteerTasks(event.target.value)} placeholder={t("Tasks volunteers will do")} /></label>
          <label className="field-label">{t("What to bring")} <span className="optional-label">{t("Optional · one per line")}</span><textarea rows="2" value={volunteerWhatToBring} onChange={(event) => setVolunteerWhatToBring(event.target.value)} placeholder={t("Organizer-provided supplies guidance")} /></label>
        </div>
        <div className="volunteer-create-meta">
          <label className="field-label">{t("Starts")} <span className="optional-label">{t("Optional")}</span><input type="datetime-local" value={volunteerStartsAt} onChange={(event) => setVolunteerStartsAt(event.target.value)} /></label>
          <label className="field-label">{t("Ends")} <span className="optional-label">{t("Optional")}</span><input type="datetime-local" min={volunteerStartsAt || undefined} value={volunteerEndsAt} onChange={(event) => setVolunteerEndsAt(event.target.value)} /></label>
          <label className="field-label">{t("Volunteer limit")} <span className="optional-label">{t("Optional")}</span><input type="number" min="1" step="1" value={volunteerCapacity} onChange={(event) => setVolunteerCapacity(event.target.value)} placeholder={t("No limit")} /></label>
          <button className="primary-button volunteer-publish-button" type="submit" disabled={publishingOpportunity}>{publishingOpportunity ? t("Saving…") : editingVolunteerOpportunity ? t("Save activity") : t("Publish opportunity")}</button>
          {editingVolunteerOpportunity && <button className="outline-button volunteer-publish-button" type="button" onClick={() => { setEditingVolunteerOpportunity(null); setOpportunityMessage(''); }}>{t("Cancel edit")}</button>}
        </div>
        {opportunityMessage && <p className={opportunityMessage.startsWith('Published.') || opportunityMessage.startsWith('Activity details saved.') || opportunityMessage.startsWith('Editing this activity.') ? 'form-success' : 'form-error'} role="status">{t(opportunityMessage)}</p>}
      </form>
        <div className="volunteer-managed-list" aria-label={t("Volunteer opportunities and signup totals")}>
          <h3>{t("Published opportunities")}</h3>
          {volunteerOverviewError ? <p>{t("Opportunity totals could not be loaded.")}</p>
            : volunteerOverview.opportunities.length ? <ul>{volunteerOverview.opportunities.map((opportunity) => {
              const relatedReport = reports.find((report) => report.id === opportunity.report_id);
              const signupCount = volunteerOverview.signupCounts[opportunity.id] ?? 0;
              return <li key={opportunity.id}>
                <span><strong>{opportunity.title}</strong><small>{relatedReport ? `${relatedReport.municipality} · ${relatedReport.title}` : opportunity.municipality || t("Eastern Samar")}</small></span>
                <span className="volunteer-managed-status">{formatStatus(opportunity.status)}</span>
                <b>{signupCount} {signupCount === 1 ? t("signup") : t("signups")}</b>
                <span className="volunteer-managed-actions"><button type="button" onClick={() => openVolunteerManagement(opportunity)}>{t("Manage")}</button><button type="button" onClick={() => editVolunteerOpportunity(opportunity)}>{t("Edit")}</button>{!['cancelled', 'completed'].includes(opportunity.status) && <button type="button" onClick={() => changeVolunteerActivityStatus(opportunity, 'cancelled')}>{t("Cancel activity")}</button>}</span>
              </li>;
            })}</ul>
              : <p>{t("No volunteer opportunities have been published yet.")}</p>}
        </div>
    </section>
    {isAdmin && <section className="role-management" aria-labelledby="role-management-title">
      <div><span className="eyebrow">{t("ADMIN ONLY")}</span><h2 id="role-management-title">{t("Account roles")}</h2><p>{t("Only administrators can grant moderator or administrator access.")}</p></div>
      <div className="role-list">{profiles.map((profile) => <label className="role-row" key={profile.id}><span>{profile.display_name || profile.id.slice(0, 8)}<small>{profile.id}</small></span><select aria-label={t("Role for {{value1}}", { value1: profile.display_name || profile.id })} value={profile.role} onChange={(event) => onChangeRole(profile.id, event.target.value)}><option value="resident">{t("Resident")}</option><option value="moderator">{t("Moderator")}</option><option value="admin">{t("Administrator")}</option></select></label>)}</div>
    </section>}
    {selected && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setSelected(null)}>
      <section ref={reviewDialogRef} tabIndex={-1} className="report-modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-detail-title" aria-busy={busy}>
        <div className="modal-head"><div><span className="eyebrow">{t("REPORT REVIEW")}</span><h2 id="review-detail-title">{selected.title}</h2></div><LanguageSelector compact /><button className="icon-button" onClick={() => setSelected(null)} aria-label={t("Close report review")}><X size={19} /></button></div>
        <div className="review-detail-meta"><span>{t(categoryNames[selected.category_slug] ?? selected.category_slug)}</span><span><MapPin size={13} />{selected.barangay ? `${selected.barangay}, ` : ''}{selected.municipality}</span><span>{new Date(selected.created_at).toLocaleString(locale())}</span></div>
        <p className="review-description">{selected.description}</p>
        {selected.needed_by && <p className="review-needed-by">{t("Needed by")} {new Date(`${selected.needed_by}T12:00:00`).toLocaleDateString(locale())}</p>}
        {evidence.length > 0 && <div className="evidence-gallery">{evidence.map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><img src={item.url} alt={t("Private evidence attached to this report")} /></a>)}</div>}
        <section className="ai-review-panel" aria-label={t("Automated screening advisory")}>
          <div className="ai-review-heading"><strong>{t("Automated screening")}</strong><span>{t("Advisory only · human decision required")}</span></div>
          <ScreeningAdvisory loading={aiReviewLoading} error={aiReviewError} review={aiReview} />
        </section>
        <form onSubmit={saveReview}>
          <div className="form-row">
            <label className="field-label">{t("Set status")}<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{reportStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
            <label className="field-label">{t("Set priority")}<select value={nextPriority} onChange={(event) => setNextPriority(event.target.value)}>{reportPriorities.map((priority) => <option key={priority} value={priority}>{t(priorityLabels[priority])}</option>)}</select></label>
          </div>
          <label className="field-label">{t("Reason for the reporter")} {needsResidentReason && <span className="optional-label">{t("Required")}</span>}{!needsResidentReason && <span className="optional-label">{t("Optional")}</span>}<textarea rows="2" maxLength="600" required={needsResidentReason} value={residentNote} onChange={(event) => setResidentNote(event.target.value)} placeholder={needsResidentReason ? t("Only the reporter sees this reason.") : t("An optional note the reporter will see with the decision.")} /></label>
          <label className="field-label">{t("Internal moderation note")} <span className="optional-label">{t("Private to staff")}</span><textarea rows="3" maxLength="4000" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("Visible only to authorized moderators.")} /></label>
          {message && <p className={message === 'Review decision saved.' ? 'form-success' : 'form-error'} role="status">{t(message)}</p>}
          <div className="modal-foot"><span>{t("Automated flags never approve or publish a report.")}</span><button className="primary-button" type="submit" disabled={busy}>{busy ? t("Saving…") : <><Check size={16} />  {t("Save review")}</>}</button></div>
        </form>
      </section>
    </div>}
    {managedOpportunity && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !managementBusy && setManagedOpportunity(null)}>
      <section ref={volunteerManagerRef} tabIndex={-1} className="report-modal volunteer-manager-modal" role="dialog" aria-modal="true" aria-labelledby="volunteer-manager-title" aria-busy={managementBusy}>
        <div className="modal-head"><div><span className="eyebrow">{t("AUTHORIZED COORDINATION")}</span><h2 id="volunteer-manager-title">{managedOpportunity.title}</h2></div><LanguageSelector compact /><button type="button" className="icon-button" onClick={() => setManagedOpportunity(null)} aria-label={t("Close volunteer management")}><X size={19} /></button></div>
        <div className="volunteer-manager-status-actions"><span>{t("Activity:")} <strong>{formatStatus(managedOpportunity.status)}</strong>  {t("· Registration:")} <strong>{managedOpportunity.registration_open === false ? t("Closed") : t("Open")}</strong></span>{!['completed', 'cancelled'].includes(managedOpportunity.status) && <><button type="button" className="outline-button" disabled={managementBusy} onClick={() => changeVolunteerRegistrationOpen(managedOpportunity, managedOpportunity.registration_open === false)}> {managedOpportunity.registration_open === false ? t("Open registration") : t("Close registration")}</button><button type="button" className="outline-button" disabled={managementBusy} onClick={() => changeVolunteerActivityStatus(managedOpportunity, 'completed')}>{t("Mark activity completed")}</button><button type="button" className="outline-button" disabled={managementBusy} onClick={() => changeVolunteerActivityStatus(managedOpportunity, 'cancelled')}>{t("Cancel activity")}</button></>}</div>
        {managementMessage && <p className={managementMessage.endsWith('saved.') ? 'form-success' : 'form-error'} role="status">{t(managementMessage)}</p>}
        <div className="volunteer-registrant-list"><h3>{t("Registered volunteers ·")} {managedRegistrations.length}</h3>
          {managementBusy && !managedRegistrations.length ? <p>{t("Loading registrations…")}</p>
            : managedRegistrations.length ? managedRegistrations.map((registration) => {
              const draft = attendanceDrafts[registration.id] ?? { status: registration.status, volunteerHours: registration.volunteer_hours ?? '' };
              const ownRegistration = registration.volunteer_id === currentUserId;
              return <div className="volunteer-registrant-row" key={registration.id}>
                <span><strong>{registration.volunteer?.display_name || registration.volunteer_id.slice(0, 8)}</strong><small>{t("Joined")} {new Date(registration.joined_at).toLocaleDateString(locale())}</small>{ownRegistration && <small>{t("Another staff member must verify your attendance and hours.")}</small>}</span>
                <label>{t("Status")}<select disabled={managementBusy || ownRegistration} value={draft.status} onChange={(event) => setAttendanceDrafts((current) => ({ ...current, [registration.id]: { ...draft, status: event.target.value } }))}><option value="registered">{t("Registered")}</option><option value="attended">{t("Attended")}</option><option value="completed">{t("Completed")}</option><option value="cancelled">{t("Cancelled")}</option><option value="no_show">{t("No show")}</option></select></label>
                <label>{t("Hours")}<input disabled={managementBusy || ownRegistration} type="number" min="0" step="0.25" value={draft.volunteerHours} onChange={(event) => setAttendanceDrafts((current) => ({ ...current, [registration.id]: { ...draft, volunteerHours: event.target.value } }))} /></label>
                <button type="button" className="outline-button" disabled={managementBusy || ownRegistration} onClick={() => saveVolunteerAttendance(registration)}>{t("Save")}</button>
              </div>;
            }) : <div className="volunteer-manager-empty"><strong>{t("No volunteers have registered yet.")}</strong><span>{t("Registrations will appear here when residents join.")}</span></div>}
        </div>
        <div className="modal-foot"><span>{t("Only staff can change attendance or recorded hours.")}</span><button type="button" className="outline-button" onClick={() => { const opportunity = managedOpportunity; setManagedOpportunity(null); editVolunteerOpportunity(opportunity); }}>{t("Edit activity")}</button><button type="button" className="outline-button" onClick={() => setManagedOpportunity(null)}>{t("Done")}</button></div>
      </section>
    </div>}
    <details className="civic-guide"><summary>{t("Volunteer participation by activity")}</summary><p>{t("Registration counts for the loaded activities. Cancelled and no-show registrations are excluded.")}</p>{volunteerOverviewError ? <p>{t("Participation data could not be loaded.")}</p> : volunteerOverview.opportunities.length ? volunteerOverview.opportunities.map(activity=><p key={activity.id}>{activity.title} <meter min="0" max={Math.max(1,...Object.values(volunteerOverview.signupCounts))} value={volunteerOverview.signupCounts[activity.id] || 0} aria-label={t("{{value1}} registrations", { value1: activity.title })} /> {volunteerOverview.signupCounts[activity.id] || 0}</p>) : <p>{t("No activities loaded.")}</p>}</details>
    <AuditHistory />
  </section>;
}

import { useState } from 'react';
import { AlertTriangle, Check, Clock3, FileText, MapPin, Search, ShieldCheck, X } from 'lucide-react';
import { formatStatus, reportPriorities, reportStatuses } from '../lib/reports.js';

const priorityLabels = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
const priorityColors = { low: '#71827c', normal: '#4d7f9d', high: '#bd7837', urgent: '#bd4d43' };

function Metric({ label, value, icon: Icon, tone = 'green' }) {
  return <div className="review-metric"><span className={`review-metric-icon ${tone}`}><Icon size={16} /></span><span><strong>{value}</strong><small>{label}</small></span></div>;
}

function ScreeningAdvisory({ loading, error, review }) {
  if (loading) return <p>Loading screening record…</p>;
  if (error) return <p>Screening status could not be loaded. Continue with human review.</p>;

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
    <p>{message}</p>
    {flags.length > 0 && <ul className="ai-review-flags">{flags.map((flag) => (
      <li key={flag.id}>
        <strong>{formatStatus(flag.flag_type)}</strong>
        {flag.confidence !== null && <small>Model confidence estimate: {Math.round(flag.confidence * 100)}%</small>}
        <p>{flag.explanation}</p>
      </li>
    ))}</ul>}
  </>;
}

export default function ModeratorDashboard({ reports, categories, profiles, isAdmin, onModerate, onChangeRole, onLoadEvidence, onLoadAIReview }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selected, setSelected] = useState(null);
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
  const [currentTime] = useState(() => Date.now());

  const categoryNames = Object.fromEntries(categories.map((category) => [category.slug, category.name]));
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

  const needsResidentReason = nextStatus === 'rejected' || nextStatus === 'needs_more_information';

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
      <div><span className="eyebrow">AUTHORIZED REVIEWERS</span><h1 id="review-title">Moderation queue</h1><p>Review private submissions before anything is published.</p></div>
      <span className="review-role"><ShieldCheck size={15} /> {isAdmin ? 'Administrator' : 'Moderator'}</span>
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
      <label className="review-search"><Search size={15} /><input aria-label="Search reports" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, area, or details" /></label>
      <label className="review-filter"><span>Status</span><select aria-label="Filter by review status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{reportStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
      <label className="review-filter"><span>Priority</span><select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All priorities</option>{reportPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label>
    </div>
    <div className="review-table-wrap">
      <table className="review-table">
        <thead><tr><th scope="col">Concern</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Submitted</th><th scope="col">Needed by</th></tr></thead>
        <tbody>{filtered.map((report) => <tr key={report.id} onClick={() => openReport(report)} tabIndex="0" onKeyDown={(event) => event.key === 'Enter' && openReport(report)}>
          <td><button className="review-report-title" onClick={(event) => { event.stopPropagation(); openReport(report); }}>{report.title}</button><small>{categoryNames[report.category_slug] ?? report.category_slug}</small></td>
          <td>{report.barangay ? `${report.barangay}, ` : ''}{report.municipality}</td>
          <td><span className="review-status">{formatStatus(report.status)}</span></td>
          <td><span className="review-priority" style={{ '--priority-color': priorityColors[report.priority] }}>{priorityLabels[report.priority]}</span></td>
          <td>{new Date(report.created_at).toLocaleDateString('en-PH')}</td>
          <td>{report.needed_by ? new Date(`${report.needed_by}T12:00:00`).toLocaleDateString('en-PH') : '—'}</td>
        </tr>)}</tbody>
      </table>
      {!filtered.length && <div className="review-empty"><FileText size={21} /><strong>No reports match</strong><span>Try another filter. New submissions will appear here.</span></div>}
    </div>
    {isAdmin && <section className="role-management" aria-labelledby="role-management-title">
      <div><span className="eyebrow">ADMIN ONLY</span><h2 id="role-management-title">Account roles</h2><p>Only administrators can grant moderator or administrator access.</p></div>
      <div className="role-list">{profiles.map((profile) => <label className="role-row" key={profile.id}><span>{profile.display_name || profile.id.slice(0, 8)}<small>{profile.id}</small></span><select aria-label={`Role for ${profile.display_name || profile.id}`} value={profile.role} onChange={(event) => onChangeRole(profile.id, event.target.value)}><option value="resident">Resident</option><option value="moderator">Moderator</option><option value="admin">Administrator</option></select></label>)}</div>
    </section>}
    {selected && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
      <section className="report-modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-detail-title">
        <div className="modal-head"><div><span className="eyebrow">REPORT REVIEW</span><h2 id="review-detail-title">{selected.title}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close report review"><X size={19} /></button></div>
        <div className="review-detail-meta"><span>{categoryNames[selected.category_slug] ?? selected.category_slug}</span><span><MapPin size={13} />{selected.barangay ? `${selected.barangay}, ` : ''}{selected.municipality}</span><span>{new Date(selected.created_at).toLocaleString('en-PH')}</span></div>
        <p className="review-description">{selected.description}</p>
        {selected.needed_by && <p className="review-needed-by">Needed by {new Date(`${selected.needed_by}T12:00:00`).toLocaleDateString('en-PH')}</p>}
        {evidence.length > 0 && <div className="evidence-gallery">{evidence.map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><img src={item.url} alt="Private evidence attached to this report" /></a>)}</div>}
        <section className="ai-review-panel" aria-label="Automated screening advisory">
          <div className="ai-review-heading"><strong>Automated screening</strong><span>Advisory only · human decision required</span></div>
          <ScreeningAdvisory loading={aiReviewLoading} error={aiReviewError} review={aiReview} />
        </section>
        <form onSubmit={saveReview}>
          <div className="form-row">
            <label className="field-label">Set status<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{reportStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
            <label className="field-label">Set priority<select value={nextPriority} onChange={(event) => setNextPriority(event.target.value)}>{reportPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label>
          </div>
          <label className="field-label">Reason for the reporter {needsResidentReason && <span className="optional-label">Required</span>}{!needsResidentReason && <span className="optional-label">Optional</span>}<textarea rows="2" maxLength="600" required={needsResidentReason} value={residentNote} onChange={(event) => setResidentNote(event.target.value)} placeholder={needsResidentReason ? 'Only the reporter sees this reason.' : 'An optional note the reporter will see with the decision.'} /></label>
          <label className="field-label">Internal moderation note <span className="optional-label">Private to staff</span><textarea rows="3" maxLength="4000" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Visible only to authorized moderators." /></label>
          {message && <p className={message === 'Review decision saved.' ? 'form-success' : 'form-error'} role="status">{message}</p>}
          <div className="modal-foot"><span>Automated flags never approve or publish a report.</span><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : <><Check size={16} /> Save review</>}</button></div>
        </form>
      </section>
    </div>}
  </section>;
}

import { t, locale } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Activity, ArrowLeft, ArrowUpRight, BarChart3, ChevronRight, Clock3, Crosshair, FileCheck, Filter, ListChecks, LockKeyhole, Map, MapPin, Menu, Radio, RefreshCw, RotateCcw, Search, Settings, ShieldCheck, Users, X } from 'lucide-react';
import { MUNICIPALITIES, categoryVisual, hasCoordinates, statusColor } from '../lib/place.js';
import { supabase } from '../lib/supabase.js';
import { collectionPolicy } from '../lib/collection-policy.js';
import { fetchProfile, fetchReports, fetchReportCategories, fetchProfiles, fetchEvidence, fetchAIReview, moderateReport, setProfileRole, formatStatus, reportStatuses, publicReportStatuses } from '../lib/reports.js';
import * as volunteers from '../lib/volunteers.js';
import AuthDialog from './AuthDialog.jsx';
import LanguageSelector from './LanguageSelector.jsx';
import useDialogFocus from '../lib/useDialogFocus.js';
import ModeratorDashboard from './ModeratorDashboard.jsx';
import OperationsMap from './OperationsMap.jsx';
import './operations.css';
import './operations-shell.css';
import './operations-refresh.css';

const sections = [['Overview', Activity], ['Geographic Intelligence', Map], ['Report Review Queue', FileCheck], ['Incident Management', ListChecks], ['Volunteer Operations', Users], ['Community Analytics', BarChart3], ['Activity Logs', Radio], ['System Settings', Settings]];
const sectionLabels = { Overview: 'Overview', 'Geographic Intelligence': 'Map explorer', 'Report Review Queue': 'Review queue', 'Incident Management': 'Published reports', 'Volunteer Operations': 'Volunteers', 'Community Analytics': 'Insights', 'Activity Logs': 'Activity', 'System Settings': 'Accounts' };
const time = (value) => new Date(value).toLocaleString(locale(), { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const mobileQuery = '(max-width: 760px)';
const subscribeLayout = (notify) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
export default function OperationsCommand() {
  useTranslation();
  const [access, setAccess] = useState(supabase ? 'checking' : 'unconfigured');
  const [profile, setProfile] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [section, setSection] = useState('Overview');
  const [menu, setMenu] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [reports, setReports] = useState(null);
  const [categories, setCategories] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [events, setEvents] = useState(null);
  const [opportunities, setOpportunities] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [municipality, setMunicipality] = useState('all');
  const [barangay, setBarangay] = useState('all');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const [inspecting, setInspecting] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState('newest');
  const [reviewTarget, setReviewTarget] = useState(null);
  const mobile = useSyncExternalStore(subscribeLayout, mobileSnapshot, () => false);
  const filterDialog = useDialogFocus({ active: filtersOpen && mobile, onClose: () => setFiltersOpen(false) });
  const navigationDialog = useDialogFocus({ active: menu && mobile, onClose: () => setMenu(false) });
  const feedDialog = useDialogFocus({ active: feedOpen && mobile, onClose: () => setFeedOpen(false) });
  const [reset] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  const searchRef = useRef(null);
  const epoch = useRef(0);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    async function check(session) {
      const version = ++epoch.current;
      setAccess('checking'); setProfile(null); setReports(null); setEvents(null); setProfiles([]); setOpportunities(null); setSelected(null); setInspecting(null);
      if (!session?.user) { if (alive) setAccess('signed-out'); return; }
      try {
        const next = await fetchProfile(session.user.id);
        if (!alive || version !== epoch.current) return;
        setProfile(next); setAccess(['admin', 'moderator'].includes(next?.role) ? 'staff' : 'denied');
      } catch { if (alive && version === epoch.current) setAccess('denied'); }
    }
    supabase.auth.getSession().then(({ data }) => check(data.session)).catch(() => { if (alive) setAccess('denied'); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => { if (alive) check(session); }, 0); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  const refresh = useCallback(async () => {
    if (access !== 'staff') return;
    const version = epoch.current;
    setBusy(true); setError('');
    const results = await Promise.allSettled([
      fetchReports(), fetchReportCategories(),
      supabase.from('report_events').select('id,report_id,actor_id,status,note,created_at').order('created_at', { ascending: false }).limit(100).then(({ data, error: fault }) => { if (fault) throw fault; return data; }),
      volunteers.fetchVolunteerManagementOverview(),
      profile.role === 'admin' ? fetchProfiles() : Promise.resolve([]),
    ]);
    if (version !== epoch.current) return;
    const setters = [setReports, setCategories, setEvents, (value) => setOpportunities(value.opportunities), setProfiles];
    const labels = ['Reports', 'Categories', 'Activity history', 'Volunteer activities', 'Account roles'];
    results.forEach((result, index) => { if (result.status === 'fulfilled') setters[index](result.value); });
    setError(results.flatMap((result, index) => result.status === 'rejected' ? [t("{{value1}} could not be refreshed.", { value1: labels[index] })] : []).join(' '));
    setUpdated(new Date()); setBusy(false);
  }, [access, profile]);
  useEffect(() => { const timer = setTimeout(refresh, 0); return () => clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (access !== 'staff') return;
    // Polling works with the current schema without enabling Realtime publication.
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [access, refresh]);
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (selected) feedDialog.current?.scrollTo({ top: 0 }); }, [feedDialog, selected]);
  useEffect(() => {
    const handler = (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); searchRef.current?.focus(); } if (event.key === 'Escape') { setInspecting(null); setMenu(false); setFiltersOpen(false); } };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);
  const navigate = (next) => { setSection(next); setMenu(false); };
  const rows = reports ?? [];
  const visible = useMemo(() => (reports ?? []).filter((report) => (municipality === 'all' || report.municipality === municipality) && (barangay === 'all' || report.barangay === barangay) && (status === 'all' || report.status === status) && (category === 'all' || report.category_slug === category) && `${report.id} ${report.title} ${report.municipality} ${report.barangay ?? ''}`.toLowerCase().includes(search.toLowerCase())), [reports, municipality, barangay, status, category, search]);
  const barangays = [...new Set(rows.filter((report) => municipality === 'all' || report.municipality === municipality).map((report) => report.barangay).filter(Boolean))].sort();
  const mapView = ['Overview', 'Geographic Intelligence'].includes(section);
  const activeReport = selected ? rows.find((item) => item.id === selected.id) ?? selected : null;
  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
  const indexed = [...visible].sort((a, b) => sort === 'priority'
    ? (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4) || Date.parse(b.created_at) - Date.parse(a.created_at)
    : Date.parse(b.created_at) - Date.parse(a.created_at));
  const activeFilterCount = [municipality, barangay, status, category].filter((value) => value !== 'all').length;
  const resetFilters = () => { setMunicipality('all'); setBarangay('all'); setStatus('all'); setCategory('all'); setSearch(''); };
  const categoryNames = Object.fromEntries(categories.map((item) => [item.slug, item.name]));
  const managementView = ['Report Review Queue', 'Incident Management', 'Volunteer Operations', 'System Settings'].includes(section);
  const count = (statuses) => reports === null ? '—' : rows.filter((report) => statuses.includes(report.status)).length;
  const metricItems = [['Needs review', count(['pending_review', 'under_review', 'needs_more_information']), 'amber'], ['In progress', count(['in_progress']), 'cyan'], ['Resolved', count(['resolved']), 'green'], ['Approved / verified', count(['approved', 'verified']), 'cyan'], ['Rejected', count(['rejected']), 'muted'], ['Active activities', opportunities === null ? '—' : opportunities.filter((item) => !['completed', 'cancelled', 'draft'].includes(item.status)).length, 'green']];
  const selectReport = (report) => { setSelected(report); if (!mobile) setFeedOpen(true); };
  const managementProps = {
    reports: section === 'Incident Management' ? rows.filter((report) => publicReportStatuses.includes(report.status)) : rows,
    categories, profiles, isAdmin: profile?.role === 'admin', currentUserId: profile?.id,
    initialReportId: section === 'Report Review Queue' ? reviewTarget : null,
    onModerate: async (values) => { await moderateReport(values); await refresh(); },
    onChangeRole: async (id, role) => { try { await setProfileRole(id, role); if (id === profile.id) window.location.reload(); else await refresh(); } catch { setError('The account role could not be changed.'); } },
    onLoadEvidence: fetchEvidence, onLoadAIReview: fetchAIReview,
    onCreateVolunteerOpportunity: volunteers.createVolunteerOpportunity, onUpdateVolunteerOpportunity: volunteers.updateVolunteerOpportunity,
    onLoadVolunteerManagement: volunteers.fetchVolunteerManagementOverview, onLoadVolunteerRegistrations: volunteers.fetchOpportunityRegistrations,
    onUpdateVolunteerRegistration: volunteers.updateVolunteerRegistration,
    onUpdateVolunteerOpportunityStatus: volunteers.updateVolunteerOpportunityStatus, onSetVolunteerRegistrationOpen: volunteers.setVolunteerRegistrationOpen,
  };
  return <div className={`operations ${access === 'staff' ? 'ops-staff' : ''}${feedOpen ? ' has-feed' : ''}`} data-theme="dark">
    <header className="ops-header"><a className="ops-brand" href={import.meta.env.BASE_URL}><img src={`${import.meta.env.BASE_URL}community-mark.svg`} width="38" height="38" alt="" /><span>{t("SMART ESTE")}<small>{t("OPERATIONS · EASTERN SAMAR")}</small></span></a><div className="ops-header-label"><i />  {t("STAFF WORKSPACE")}</div><LanguageSelector compact />{collectionPolicy.kind === 'staging' && <span className="testing-environment-label" title={t('Testing environment · authorized testers only')}>{t('Testing')}</span>}<div className="ops-clock">{clock.toLocaleTimeString(locale(), { timeZone: 'Asia/Manila', hour12: false, hour: '2-digit', minute: '2-digit' })}<small>{t("MANILA TIME")}</small></div></header>
    {access !== 'staff' ? <main className="ops-access"><LockKeyhole size={40} /><p className="ops-kicker">{t("AUTHORIZED PERSONNEL")}</p><h1>{t("Operations Command")}</h1><p>{access === 'checking' ? t("Verifying your staff access…") : access === 'unconfigured' ? t("Connect the existing Supabase project to enable staff authentication.") : access === 'denied' ? t("An administrator or moderator account is required.") : t("Sign in to access community reports and coordination tools.")}</p>{access === 'signed-out' && <button onClick={() => setAuthOpen(true)}>{t("Sign in to operations")}</button>}<a href={import.meta.env.BASE_URL}>{t("Return to the community map")}</a></main> : <>
    <div className="ops-layout"><aside ref={navigationDialog} role={mobile && menu ? 'dialog' : undefined} aria-modal={mobile && menu ? true : undefined} aria-label={t("Operations navigation menu")} tabIndex={-1} className={`ops-nav ${menu ? 'is-open' : ''}`}><div className="ops-nav-heading"><p className="ops-kicker">{t("YOUR WORKSPACE")}</p><button type="button" className="ops-nav-close" aria-label={t("Close operations navigation")} onClick={() => setMenu(false)}><X size={20} /></button></div><h2>{t("Local action.")}</h2><nav aria-label={t("Operations navigation")}>{sections.map(([name, Icon]) => <button key={name} className={section === name ? 'active' : ''} aria-current={section === name ? 'page' : undefined} onClick={() => navigate(name)}><Icon size={17} /><span>{t(sectionLabels[name])}</span></button>)}</nav><div className="ops-nav-foot"><ShieldCheck size={18} /><strong>{profile.display_name || t("Staff account")}</strong><small>{formatStatus(profile.role)}  {t("access")}</small><a href={import.meta.env.BASE_URL}><ArrowLeft size={13} />  {t("Community map")}</a><button onClick={() => supabase.auth.signOut()}>{t("Sign out")}</button></div></aside>
    <main className={`ops-main ${mapView ? 'is-map-view' : ''}`}><div className="ops-heading"><div><p className="ops-kicker">{t("SMART ESTE / OPERATIONS")}</p><h1>{section === "Overview" ? t("Focus on what’s next.") : t(sectionLabels[section])}</h1><p>{section === "Overview" ? t("The local picture. The work ahead.") : t("One workspace for coordinated community action.")}</p></div><button type="button" aria-expanded={feedOpen} aria-controls="operations-feed" onClick={() => setFeedOpen((value) => !value)}><Radio size={16} />  {t("Activity")}</button><button onClick={refresh} disabled={busy} aria-label={t("Refresh operations data")}><RefreshCw size={16} className={busy ? 'ops-spin' : ''} /><span>{busy ? t("Refreshing") : t("Refresh")}</span></button></div>
    {error && <p className="ops-error" role="alert">{t(error)}  {t("Previously loaded records may be out of date.")}</p>}
    <div className="ops-metrics" id="operations-indicators">{metricItems.slice(0, metricsOpen ? metricItems.length : 3).map(([label, value, tone]) => <div key={label}><span>{t(label)}</span><strong className={tone}>{value}</strong></div>)}</div><button className="ops-metrics-toggle" type="button" aria-expanded={metricsOpen} aria-controls="operations-indicators" onClick={() => setMetricsOpen((value) => !value)}>{metricsOpen ? t("Fewer indicators") : t("More indicators")}<ChevronRight size={14} /></button>
    {mapView && <section className="ops-geography" aria-label={t("Geographic operations")}>
      <div className="ops-geography-heading"><div><span className="ops-section-number">01 /</span><h2><Crosshair size={17} />  {t("Geographic operations")}</h2><span className="ops-province-chip">{t("REGION VIII")}</span></div><span className="ops-map-scope">{t("EASTERN SAMAR · PHILIPPINES")}</span></div>
      <div className="ops-searchbar"><label><Search size={17} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Find a report, municipality, or barangay…")} aria-label={t("Search reports or locations")} /><kbd>{t("Ctrl K")}</kbd></label><button aria-expanded={filtersOpen} aria-controls="ops-location-filters" className={activeFilterCount ? 'has-filters' : ''} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15} />  {t("Filters")}{activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button></div>
      <div className={`ops-location-filters ${filtersOpen ? 'is-open' : ''}`} id="ops-location-filters" ref={filterDialog} role={mobile && filtersOpen ? 'dialog' : undefined} aria-modal={mobile && filtersOpen ? true : undefined} aria-label={t("Map filters")} tabIndex={-1}><div className="ops-filter-sheet-heading"><strong>{t("Filter the map")}</strong><button aria-label={t("Close filters")} onClick={() => setFiltersOpen(false)}><X size={18} /></button></div><label>{t("Municipality")}<select value={municipality} onChange={(event) => { setMunicipality(event.target.value); setBarangay('all'); }}><option value="all">{t("All municipalities")}</option>{MUNICIPALITIES.map((name) => <option key={name}>{t(name)}</option>)}</select></label><label>{t("Barangay")}<select value={barangay} onChange={(event) => setBarangay(event.target.value)}><option value="all">{t("All reported barangays")}</option>{barangays.map((name) => <option key={name}>{t(name)}</option>)}</select></label><label>{t("Status")}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t("All statuses")}</option>{reportStatuses.map((name) => <option key={name} value={name}>{formatStatus(name)}</option>)}</select></label><label>{t("Category")}<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{t("All categories")}</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}</select></label>{activeFilterCount > 0 && <button className="ops-clear-filters" onClick={resetFilters}><RotateCcw size={13} />  {t("Reset")}</button>}<button className="ops-filter-sheet-apply" onClick={() => setFiltersOpen(false)}>{t("Show")} {visible.length}  {t("matching reports")}</button></div>
      <div className="ops-status-tabs" aria-label={t("Quick status filters")}>{[['all', 'All reports'], ['pending_review', 'Pending review'], ['in_progress', 'In progress'], ['resolved', 'Resolved']].map(([value, label]) => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}><i style={{ background: value === 'all' ? '#6cbeb8' : statusColor(value, 'dark') }} />{t(label)}<span>{reports === null ? '—' : value === "all" ? rows.length : rows.filter((item) => item.status === value).length}</span></button>)}</div>
      <OperationsMap reports={visible} categories={categories} selected={activeReport} onSelect={selectReport} onInspect={setInspecting} reset={reset} />
      {activeReport && <div className="ops-mobile-selection"><SelectionSummary report={activeReport} categoryName={categoryNames[activeReport.category_slug]} onClose={() => setSelected(null)} onInspect={() => setInspecting(activeReport)} /></div>}
      <div className="ops-report-index"><div className="ops-panel-title"><span>{t("REPORT INDEX")} <b>{visible.length}</b></span><label>{t("Sort")}<select aria-label={t("Sort reports")} value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">{t("Newest first")}</option><option value="priority">{t("Priority first")}</option></select></label></div>
      <div className="ops-index-columns"><span>{t("REFERENCE")}</span><span>{t("COMMUNITY CONCERN")}</span><span>{t("STATUS")}</span><span /></div>
      {indexed.slice(0, 50).map((report) => <button className={selected?.id === report.id ? 'is-selected' : ''} key={report.id} onClick={() => selectReport(report)}><span className="ops-ref">{report.id.slice(0, 8).toUpperCase()}</span><span className="ops-index-concern"><strong>{report.title}</strong><small><MapPin size={10} />{report.barangay ? `${report.barangay}, ` : ''}{report.municipality}</small></span><span className="ops-status-pill" style={{ '--status-color': statusColor(report.status, 'dark') }}>{formatStatus(report.status)}</span><ChevronRight size={14} /></button>)}
      {!visible.length && <div className="ops-index-empty"><MapPin size={23} /><strong>{reports === null ? t("Waiting for report data") : t("No reports in this view")}</strong><p>{reports === null ? t("Authorized reports will appear after they load.") : t("Try another location or clear your filters.")}</p>{activeFilterCount > 0 && <button onClick={resetFilters}>{t("Clear filters")}</button>}</div>}
      {visible.length > 50 && <p>{t("Showing the first 50 matching reports. Narrow your search to locate others.")}</p>}</div>
    </section>}
    {managementView && <div className={`ops-management mode-${section.split(' ')[0].toLowerCase()}`}><ModeratorDashboard {...managementProps} /></div>}
    {section === "Community Analytics" && <section className="ops-analytics"><h2>{t("Report distribution")}</h2><p>{t("Counts reflect up to 500 authorized reports loaded from the current backend.")}</p>{MUNICIPALITIES.map((name) => { const total = rows.filter((report) => report.municipality === name).length; return <div key={name}><span>{t(name)}</span><meter value={total} min="0" max={Math.max(rows.length, 1)} /><strong>{reports === null ? '—' : total}</strong></div>; })}</section>}
    {section === "Activity Logs" && <section className="ops-history"><h2>{t("Report status history")}</h2><p>{t("Existing database-generated report events. Most recent 100 records; this is not a complete administrative audit log.")}</p>{events?.map((event) => <article key={event.id}><small>{time(event.created_at)}</small><strong>{formatStatus(event.status)}</strong><span>{t("Report")} {event.report_id}  {t("· Actor")} {event.actor_id || t("Unavailable")}</span>{event.note && <p>{event.note}</p>}</article>)}{!events?.length && <p>{events === null ? t("History is unavailable.") : t("No recorded report events.")}</p>}</section>}
    </main><aside ref={feedDialog} role={mobile && feedOpen ? 'dialog' : undefined} aria-modal={mobile && feedOpen ? true : undefined} tabIndex={-1} className="ops-feed" id="operations-feed" aria-label={t("Operations feed and selected report")} hidden={!feedOpen}><button type="button" className="ops-feed-close" aria-label={t("Close operations feed")} onClick={() => setFeedOpen(false)}><X size={19} /></button>
      {activeReport && mapView && <div className="ops-selection-dock"><div className="ops-panel-title"><Crosshair size={14} />  {t("SELECTED REPORT")}</div><SelectionSummary report={activeReport} categoryName={categoryNames[activeReport.category_slug]} onClose={() => setSelected(null)} onInspect={() => setInspecting(activeReport)} /></div>}
      <div className="ops-panel-title"><Radio size={15} />  {t("OPERATIONS FEED")} <i /></div><p className="ops-feed-intro">{t("Report status changes")}<span>{t("Refreshes every 60 seconds")}</span></p>
      {events?.slice(0, 12).map((event) => <button key={event.id} onClick={() => { const report = rows.find((item) => item.id === event.report_id); if (report) { navigate('Overview'); setSelected(report); } }} disabled={!rows.some((item) => item.id === event.report_id)}><div className="ops-event-line"><i style={{ background: statusColor(event.status, 'dark') }} /><strong>{formatStatus(event.status)}</strong></div><span>{rows.find((item) => item.id === event.report_id)?.title || t("Report {{value1}}", { value1: event.report_id.slice(0, 8) })}</span><small><Clock3 size={10} />{time(event.created_at)}</small></button>)}
      {!events?.length && <div className="ops-feed-empty"><Radio size={22} /><strong>{events === null ? t("Connecting to the feed") : t("No status changes yet")}</strong><p>{events === null ? t("Report history appears here when available.") : t("Updates will appear as reports move through review.")}</p></div>}
      <div className="ops-scope"><p className="ops-kicker">{t("COVERAGE AREA")}</p><strong><MapPin size={16} />  {t("Eastern Samar")}</strong><p>{t("1 city · 22 municipalities")}</p><small>{t("Map pins use submitted coordinates and may be approximate. Select a report to inspect its details.")}</small></div>
    </aside></div>
    <footer className="ops-footer"><span><i /> {busy ? t("REFRESHING") : error ? t("PARTIAL DATA") : t("STAFF SESSION")}</span><span>{updated ? t("LAST REFRESH ATTEMPT {{value1}}", { value1: time(updated) }) : t("AWAITING DATA")}  {t("· UP TO 500 REPORTS")}</span><span>{t("CIVIC ACTION / EASTERN SAMAR")}</span></footer>
    <nav className="ops-bottom-nav" aria-label={t("Mobile operations navigation")}>{[['Overview', Activity, 'Overview'], ['Report Review Queue', FileCheck, 'Review'], ['Volunteer Operations', Users, 'Volunteers']].map(([name, Icon, label]) => <button type="button" key={name} aria-current={section === name ? 'page' : undefined} onClick={() => navigate(name)}><Icon size={19} /><span>{t(label)}</span></button>)}<button type="button" aria-expanded={menu} onClick={() => { setMenu((value) => !value); setFeedOpen(false); }}><Menu size={19} /><span>{t("More")}</span></button></nav>
    {inspecting && <ReportInspection key={inspecting.id} report={inspecting} onClose={() => setInspecting(null)} onReview={() => { setReviewTarget(inspecting.id); setInspecting(null); navigate('Report Review Queue'); }} />}
    </>}
    {authOpen && supabase && <AuthDialog supabase={supabase} initialMode="sign-in" onNotice={setError} onAuthenticated={() => setAuthOpen(false)} onClose={() => setAuthOpen(false)} />}
  </div>;
}
function SelectionSummary({ report, categoryName, onClose, onInspect }) {
  useTranslation();
  const color = categoryVisual(report.category_slug, 'dark').color;
  return <section className="ops-selection-summary" aria-label={t("Selected report summary")}>
    <button className="ops-selection-close" aria-label={t("Clear selected report")} onClick={onClose}><X size={14} /></button>
    <p className="ops-kicker">{t("REPORT /")} {report.id.slice(0, 8).toUpperCase()}</p>
    <span className="ops-selection-category" style={{ color }}><i style={{ background: color }} />{t(categoryName) || formatStatus(report.category_slug)}</span>
    <h2>{report.title}</h2><p className="ops-selection-location"><MapPin size={13} />{report.barangay ? `${report.barangay}, ` : ''}{report.municipality}</p>
    <span className="ops-status-pill" style={{ '--status-color': statusColor(report.status, 'dark') }}>{formatStatus(report.status)}</span>
    <p className="ops-selection-description">{report.description}</p>
    <div className="ops-selection-meta"><span>{t("PRIORITY")}<strong>{formatStatus(report.priority)}</strong></span><span>{t("LOCATION")}<strong>{hasCoordinates(report) ? t("Mapped") : t("Not provided")}</strong></span></div>
    <button className="ops-inspect-action" onClick={onInspect}>{t("Inspect report")} <ArrowUpRight size={15} /></button>
  </section>;
}
function ReportInspection({ report, onClose, onReview }) {
  useTranslation();
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const dialogRef = useDialogFocus({ onClose });
  useEffect(() => {
    let active = true;
    supabase.from('report_events').select('id,status,created_at').eq('report_id', report.id).order('created_at').then(({ data, error: fault }) => { if (active) { if (fault) setError('Timeline could not be loaded.'); else setHistory(data); } });
    return () => { active = false; };
  }, [report.id]);
  return <div className="ops-inspect-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className="ops-inspect" role="dialog" aria-modal="true" aria-labelledby="ops-inspect-title"><button className="ops-close" aria-label={t("Close report inspection")} onClick={onClose}><X size={18} /></button><p className="ops-kicker">{t("REPORT /")} {report.id}</p><h2 id="ops-inspect-title">{report.title}</h2><p>{report.barangay ? `${report.barangay}, ` : ''}{report.municipality}</p><strong>{formatStatus(report.status)} · {formatStatus(report.priority)}</strong><p>{report.description}</p><h3>{t("Status timeline")}</h3>{t(error) || (history === null ? <p>{t("Loading timeline…")}</p> : history.map((event) => <p key={event.id}>{time(event.created_at)} · {formatStatus(event.status)}</p>))}<button onClick={onReview}>{t("Review this report")}</button><small>{t("Opens this report with its evidence and moderation controls.")}</small></section></div>;
}

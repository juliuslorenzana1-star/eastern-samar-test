import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownUp, ArrowRight, CalendarDays, Check, ChevronDown,
  CircleHelp, Compass, Filter, HeartPulse, Inbox, Layers3, LogOut, MapPin,
  Menu, Plus, Search, ShieldCheck, Users, X,
} from 'lucide-react';
import AuthDialog from './components/AuthDialog.jsx';
import ModeratorDashboard from './components/ModeratorDashboard.jsx';
import ProvinceMap from './components/ProvinceMap.jsx';
import ProvincePulse from './components/ProvincePulse.jsx';
import ReportDialog from './components/ReportDialog.jsx';
import ReportDetailCard from './components/ReportDetailCard.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import VolunteerBoard from './components/VolunteerBoard.jsx';
import { isSupabaseConfigured, supabase } from './lib/supabase.js';
import {
  createReport, fetchAIReview, fetchMyReports, fetchProfile, fetchProfiles, fetchPublicReports,
  fetchReportCategories, fetchReports, fetchEvidence, formatStatus, moderateReport,
  publicReportStatuses, reportStatuses, setProfileRole,
} from './lib/reports.js';
import {
  MUNICIPALITIES, barangayCoverage, categoryCounts, categoryVisual, hasCoordinates,
  municipalityCoverage, placeLine, placeOptions, statusColor, withinDays,
} from './lib/place.js';
import {
  createVolunteerOpportunity, fetchOpportunityRegistrations, fetchVolunteerManagementOverview,
  fetchVolunteerOpportunities, fetchVolunteerSignupCounts, setVolunteerRegistrationOpen,
  updateVolunteerOpportunity, updateVolunteerOpportunityStatus, updateVolunteerRegistration,
} from './lib/volunteers.js';
import {
  applyThemeMode, readStoredThemeMode, resolveThemeMode, storeThemeMode, watchSystemTheme,
} from './lib/theme.js';

export function Status({ value, theme = 'light' }) {
  return <span className="status-pill" style={{ '--status-color': statusColor(value, theme) }}><i className="status-dot" />{formatStatus(value)}</span>;
}

function ReportRow({ report, theme, categoryName, active, onSelect, decision }) {
  const { color } = categoryVisual(report.category_slug, theme);
  return <button className={`report-card${active ? ' is-active' : ''}`} onClick={() => onSelect(report)}>
    <i className="report-card-mark" style={{ '--category-color': color }} />
    <span className="report-card-content">
      <span className="report-card-topline"><span className="report-category">{categoryName}</span><span className="report-date">{new Date(report.created_at).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })}</span></span>
      <span className="report-title">{report.title}</span>
      <span className="report-place"><MapPin size={12} />{placeLine(report)}</span>
      <span className="report-card-bottom"><Status value={report.status} theme={theme} /><span className={`report-priority is-${report.priority}`}>{report.priority}</span></span>
      {decision && <span className="report-decision">{decision}</span>}
    </span><ArrowRight className="report-arrow" size={15} />
  </button>;
}

// The plain-language outcome shown under a resident's own submission when a
// moderator left no written reason.
function decisionText(report) {
  if (report.decision_note) return report.decision_note;
  if (report.status === 'pending_review') return 'Waiting for a moderator to review this report.';
  if (report.status === 'under_review') return 'A moderator is looking into this report.';
  if (report.status === 'rejected') return 'This report was not approved for the public map.';
  if (report.status === 'approved') return 'Approved and published on the community map.';
  return null;
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [queue, setQueue] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [loadError, setLoadError] = useState('');
  const [category, setCategory] = useState('all');
  const [area, setArea] = useState('all');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [location, setLocation] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [authMode, setAuthMode] = useState(null);
  const [view, setView] = useState('map');
  const [loadedAt] = useState(() => Date.now());
  const [themeMode, setThemeMode] = useState(() => readStoredThemeMode());
  const [systemTick, setSystemTick] = useState(0);
  const [focus, setFocus] = useState(null);
  const [volunteerMapData, setVolunteerMapData] = useState({ opportunities: [], signupCounts: {} });
  const [volunteerInitial, setVolunteerInitial] = useState(null);
  const sessionUserId = session?.user?.id;
  const isStaff = profile?.role === 'moderator' || profile?.role === 'admin';
  const updateVolunteerMapData = useCallback((opportunities, signupCounts) => {
    setVolunteerMapData({ opportunities, signupCounts });
  }, []);
  const clearVolunteerInitial = useCallback(() => setVolunteerInitial(null), []);
  // Resolved once per render: a "system" preference re-resolves whenever the
  // operating system reports a change (see systemTick below).
  const theme = resolveThemeMode(themeMode);

  useEffect(() => watchSystemTheme(() => setSystemTick((tick) => tick + 1)), []);
  useEffect(() => { applyThemeMode(themeMode); }, [themeMode, systemTick]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    fetchVolunteerOpportunities()
      .then(async (opportunities) => {
        const signupCounts = await fetchVolunteerSignupCounts(opportunities.map(({ id }) => id));
        if (active) setVolunteerMapData({ opportunities, signupCounts });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function chooseThemeMode(mode) {
    storeThemeMode(mode);
    setThemeMode(mode);
  }

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setLoadError('We could not restore your sign-in session. Check your connection and try again.');
        return;
      }
      setSession(data?.session ?? null);
    }).catch(() => {
      if (active) setLoadError('We could not restore your sign-in session. Check your connection and try again.');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setProfiles([]);
        setMyReports([]);
        setShowSubmissions(false);
        setView('map');
      }
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('update');
        setFormOpen(true);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setReports([]);
      setCategories([]);
      setMyReports([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    Promise.all([
      fetchPublicReports(),
      fetchReportCategories(),
      sessionUserId ? fetchMyReports(sessionUserId) : Promise.resolve([]),
    ])
      .then(([reportData, categoryData, myData]) => {
        if (!active) return;
        setReports(reportData);
        setCategories(categoryData);
        setMyReports(myData);
      })
      .catch((error) => { if (active) setLoadError(error.message || 'We could not load community reports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionUserId]);

  // The moderation queue is a separate request that only runs for staff. Residents
  // never issue it, so a pending submission can never reach the map state.
  useEffect(() => {
    if (!isStaff) { setQueue([]); return undefined; }
    let active = true;
    fetchReports().then((data) => { if (active) setQueue(data); }).catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [isStaff]);

  useEffect(() => {
    if (!sessionUserId) return undefined;
    let active = true;
    fetchProfile(sessionUserId)
      .then((nextProfile) => { if (active) setProfile(nextProfile); })
      .catch(() => { if (active) setLoadError('Your account profile could not be loaded. Refresh and try again.'); });
    return () => { active = false; };
  }, [sessionUserId]);

  useEffect(() => {
    if (profile?.role !== 'admin') return undefined;
    let active = true;
    fetchProfiles().then((result) => { if (active) setProfiles(result); }).catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [profile?.role]);

  const categoryNames = Object.fromEntries(categories.map((item) => [item.slug, item.name]));
  // Local figures are derived from the reports already in memory — no extra
  // queries, and nothing is padded with estimates.
  const coverage = useMemo(() => municipalityCoverage(reports), [reports]);
  const places = useMemo(() => placeOptions(reports), [reports]);
  const barangays = useMemo(() => barangayCoverage(reports), [reports]);
  const thisWeek = useMemo(() => withinDays(reports, 7), [reports]);
  const categoryBase = useMemo(() => reports.filter((report) => {
    const days = dateRange === '7' ? 7 : dateRange === '30' ? 30 : dateRange === '90' ? 90 : null;
    const haystack = `${report.title} ${report.description} ${report.municipality} ${report.barangay ?? ''}`.toLowerCase();
    return (area === 'all' || report.municipality === area)
      && (status === 'all' || report.status === status)
      && haystack.includes(query.toLowerCase())
      && (days === null || Date.parse(report.created_at) >= loadedAt - days * 86400000);
  }), [area, dateRange, loadedAt, query, reports, status]);
  const filtered = useMemo(() => category === 'all'
    ? categoryBase
    : categoryBase.filter((report) => report.category_slug === category), [category, categoryBase]);
  const counts = useMemo(() => categoryCounts(categoryBase), [categoryBase]);
  const mappedCount = useMemo(() => filtered.filter(hasCoordinates).length, [filtered]);
  // Place names come from the loaded reports only, so suggestions never promise a
  // barangay the platform has no data for.
  const placeMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return [...places.municipalities, ...places.barangays]
      .filter((option) => option.label.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [query, places]);
  // Staff counts come from the moderation queue. The public feed only ever holds
  // approved reports, so a review-stage number can never show up in public stats.
  const pending = queue.filter((report) => ['pending_review', 'under_review', 'needs_more_information'].includes(report.status)).length;
  const resolved = reports.filter((report) => report.status === 'resolved').length;
  const verified = reports.filter((report) => report.status === 'verified').length;
  const statusOptions = isStaff ? reportStatuses : publicReportStatuses;
  const submissionsLabel = myReports.length ? `My submissions (${myReports.length})` : 'My submissions';
  const listCountLabel = showSubmissions
    ? `${myReports.length} ${myReports.length === 1 ? 'submission' : 'submissions'}`
    : `${filtered.length} ${filtered.length === 1 ? 'report' : 'reports'}`;

  async function reloadReports() {
    const [publicData, myData, queueData] = await Promise.all([
      fetchPublicReports(),
      sessionUserId ? fetchMyReports(sessionUserId) : Promise.resolve([]),
      isStaff ? fetchReports() : Promise.resolve([]),
    ]);
    setReports(publicData);
    setMyReports(myData);
    setQueue(queueData);
  }

  function clearFilters() { setCategory('all'); setArea('all'); setStatus('all'); setDateRange('all'); setQuery(''); }
  // A place is picked from the pulse list or a search suggestion: the map moves
  // to the centroid of the points actually stored for that place, nothing guessed.
  function focusOnPlace(place) {
    if (!place?.focus) return;
    if (place.type !== 'barangay' && place.municipality) setArea(place.municipality);
    setFocus({ latlng: place.focus, zoom: place.type === 'barangay' ? 13 : 11, nonce: Date.now() });
    if (window.innerWidth <= 900) setPanelOpen(false);
  }
  function openReport(report) {
    setSelected(report);
    if (hasCoordinates(report)) setFocus({ latlng: [Number(report.latitude), Number(report.longitude)], zoom: 14, nonce: Date.now() });
    if (window.innerWidth <= 900) setPanelOpen(false);
  }
  function startReport() {
    if (!isSupabaseConfigured) { setNotice('The shared database is not configured, so reports cannot be accepted yet.'); return; }
    if (!session?.user) { setAuthMode('sign-in'); setFormOpen(true); setNotice('Sign in to submit a report.'); return; }
    setAuthMode(null);
    setLocation(null); setFormOpen(true); setPanelOpen(false); setView('map');
  }
  function startPicking() { setPicking(true); setFormOpen(false); setNotice('Click the map to place the report pin.'); }
  function pickPoint(point) { setLocation({ lat: point.lat, lng: point.lng }); setPicking(false); setFormOpen(true); setNotice('Location added to the report.'); }
  async function submitReport(values) {
    const { warning } = await createReport(values, session?.user?.id);
    await reloadReports();
    // The new report is not on the public map yet, so do not focus it there —
    // send the resident to their own submission list instead.
    setSelected(null);
    setShowSubmissions(true);
    setPanelOpen(true);
    setNotice(warning || 'Report submitted and saved securely. Track it under My submissions — it appears on the map once a moderator approves it.');
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setNotice('We could not sign you out. Please try again.');
    else { setView('map'); setNotice('You have signed out.'); }
  }
  async function reviewReport(values) {
    await moderateReport(values);
    await reloadReports();
  }
  async function changeRole(userId, role) {
    try {
      await setProfileRole(userId, role);
      setProfiles(await fetchProfiles());
      setNotice('Account role updated.');
    } catch (error) {
      setNotice(error.message || 'Role update failed.');
    }
  }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Eastern Samar Community Action Map home"><span className="brand-mark"><Compass size={21} /></span><span className="brand-copy"><strong>Eastern Samar</strong><span>COMMUNITY ACTION MAP</span></span></a>
      <div className="topbar-center"><i className="live-indicator" /> {area === 'all' ? 'Province-wide view' : area} <span className="topbar-divider">/</span> <span>{view === 'review' ? 'Moderation queue' : view === 'volunteers' ? 'Volunteer opportunities' : 'Community reports'}</span></div>
      <div className="topbar-actions">
        {!isSupabaseConfigured && <span className="demo-label"><i /> Demo mode</span>}
        <ThemeToggle mode={themeMode} onChange={chooseThemeMode} />
        <button className="outline-button volunteer-nav-button" onClick={() => setView(view === 'volunteers' ? 'map' : 'volunteers')} aria-label={view === 'volunteers' ? 'Return to community map' : 'Open volunteer opportunities'} title={view === 'volunteers' ? 'Community map' : 'Volunteer opportunities'}>{view === 'volunteers' ? <Compass size={14} /> : <Users size={14} />}<span>{view === 'volunteers' ? 'Map' : 'Volunteers'}</span></button>
        {isStaff && <button className="outline-button review-nav-button" onClick={() => setView(view === 'review' ? 'map' : 'review')}>{view === 'review' ? 'Community map' : 'Review queue'}</button>}
        {session?.user ? <><span className="account-label">{profile?.display_name || session.user.email}</span><button className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></> : <button className="outline-button" onClick={() => { if (isSupabaseConfigured) { setAuthMode('sign-in'); setFormOpen(true); } else setNotice('Demo mode is active. Add Supabase keys to enable account sign-in and reporting.'); }}>Sign in</button>}
        <button className="icon-button mobile-menu" onClick={() => view === 'volunteers' ? document.getElementById('volunteer-opportunities')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : setPanelOpen((open) => !open)} aria-label={view === 'volunteers' ? 'Find volunteer opportunities' : 'Open report filters'} title={view === 'volunteers' ? 'Find volunteer opportunities' : 'Open report filters'}><Menu size={20} /></button>
        <button className="primary-button top-report-button" onClick={startReport}><Plus size={16} /><span className="report-label-wide">Report a concern</span><span className="report-label-compact">Report</span></button>
      </div>
    </header>
    <section className="dashboard-heading" id="top"><div className="heading-copy"><span className="eyebrow">EASTERN SAMAR · COMMUNITY ACTION MAP</span><h1 id={view === 'volunteers' ? 'volunteer-title' : undefined}>{view === 'review' ? 'Review queue' : view === 'volunteers' ? 'Volunteer' : 'Eastern Samar Community Action Map'}</h1><p>{view === 'review' ? 'Review submissions and coordinate next steps.' : view === 'volunteers' ? 'Turn community needs into community action. Find local activities, lend your skills, and help make Eastern Samar stronger.' : 'Local action, reported needs, and community updates across Eastern Samar municipalities and barangays.'}</p></div>{view !== 'volunteers' && <div className="heading-meta"><div className="privacy-note"><ShieldCheck size={16} /><span>Community-reported<br /><strong>not official findings</strong></span></div><button className="text-button" onClick={() => setNotice('Public reports are visible only after authorized staff approve them. Private exact locations and evidence are restricted by database policies.')}><CircleHelp size={16} /> About this map</button></div>}</section>
    {loadError && <div className="app-error" role="alert"><strong>Unable to load the shared platform.</strong><span>{loadError}</span><button className="outline-button" onClick={() => window.location.reload()}>Try again</button></div>}
    {view === 'volunteers' ? <VolunteerBoard
      configured={isSupabaseConfigured}
      userId={sessionUserId}
      theme={theme}
      reports={reports}
      onSignIn={(mode = 'sign-in') => {
        if (!isSupabaseConfigured) { setNotice('Account access is unavailable while the shared database is disconnected.'); return; }
        setAuthMode(mode);
        setFormOpen(true);
      }}
      onMap={() => setView('map')}
      onOpenReport={(report) => { setView('map'); openReport(report); }}
      onDataLoaded={updateVolunteerMapData}
      onShowOnMap={(opportunity) => {
        setSelected(null);
        if (hasCoordinates(opportunity)) setFocus({ latlng: [Number(opportunity.latitude), Number(opportunity.longitude)], zoom: 14, nonce: Date.now() });
        setView('map');
      }}
      initialOpportunityId={volunteerInitial?.id}
      initialAction={volunteerInitial?.action}
      onOpportunityOpened={clearVolunteerInitial}
    /> : view === 'review' && isStaff ? <ModeratorDashboard reports={queue} categories={categories} profiles={profiles} isAdmin={profile?.role === 'admin'} onModerate={reviewReport} onChangeRole={changeRole} onLoadEvidence={async (reportId) => { const result = await fetchEvidence(reportId); return result; }} onLoadAIReview={fetchAIReview} onCreateVolunteerOpportunity={createVolunteerOpportunity} onUpdateVolunteerOpportunity={updateVolunteerOpportunity} onLoadVolunteerManagement={fetchVolunteerManagementOverview} onLoadVolunteerRegistrations={fetchOpportunityRegistrations} onUpdateVolunteerRegistration={updateVolunteerRegistration} onUpdateVolunteerOpportunityStatus={updateVolunteerOpportunityStatus} onSetVolunteerRegistrationOpen={setVolunteerRegistrationOpen} /> : <>
      <section className={`workspace${panelOpen ? ' panel-open' : ''}`}>
        <aside className="report-panel">
          <div className="panel-heading"><div><span className="eyebrow">COMMUNITY PULSE</span><h2>Reported concerns <span>{filtered.length}</span></h2></div><button className="icon-button mobile-close" onClick={() => setPanelOpen(false)} aria-label="Close report panel"><X size={18} /></button></div>
          <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports, municipalities, barangays" aria-label="Search reports or places" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</div>
          {query.trim().length > 1 && (
            <div className="place-suggestions" aria-label="Places matching your search">
              {placeMatches.length ? placeMatches.map((option) => <button type="button" key={`${option.type}-${option.label}`} className="place-chip" onClick={() => focusOnPlace(option)}><MapPin size={11} /> <span>{option.label}</span> <b>{option.count}</b></button>) : <span className="place-chip-empty">No place in the published reports matches “{query.trim()}” yet.</span>}
            </div>
          )}
          <div className="filter-heading"><span><Filter size={14} /> Filters</span><button className="reset-button" onClick={clearFilters}>Reset</button></div>
          <div className="filters-grid">
            <label className="filter-select"><MapPin size={14} /><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Filter by municipality"><option value="all">All municipalities</option>{MUNICIPALITIES.map((place) => <option key={place}>{place}</option>)}</select><ChevronDown size={13} /></label>
            <label className="filter-select"><Layers3 size={14} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select><ChevronDown size={13} /></label>
            <label className="filter-select"><Activity size={14} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option>{statusOptions.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select><ChevronDown size={13} /></label>
            <label className="filter-select"><CalendarDays size={14} /><select value={dateRange} onChange={(event) => setDateRange(event.target.value)} aria-label="Filter by date"><option value="all">Any time</option><option value="7">Past 7 days</option><option value="30">Past 30 days</option><option value="90">Past 90 days</option></select><ChevronDown size={13} /></label>
          </div>
          <div className="list-toolbar"><span>{listCountLabel}</span>{sessionUserId && <button className={`sort-button${showSubmissions ? ' is-active' : ''}`} onClick={() => setShowSubmissions((open) => !open)}><Inbox size={13} /> {showSubmissions ? 'Community feed' : submissionsLabel}</button>}<button className="sort-button" onClick={() => setReports((current) => [...current].sort((first, second) => second.created_at.localeCompare(first.created_at)))}><ArrowDownUp size={13} /> Recent</button></div>
          <div className="report-list">{loading ? <div className="empty-state"><Search size={22} /><strong>Loading reports…</strong></div> : showSubmissions ? (myReports.length ? myReports.map((report) => <ReportRow key={report.id} report={report} theme={theme} decision={decisionText(report)} categoryName={categoryNames[report.category_slug] ?? report.category_slug} active={selected?.id === report.id} onSelect={openReport} />) : <div className="empty-state"><Inbox size={22} /><strong>No submissions yet</strong><span>Reports you send appear here with their review status.</span></div>) : filtered.length ? filtered.map((report) => <ReportRow key={report.id} report={report} theme={theme} categoryName={categoryNames[report.category_slug] ?? report.category_slug} active={selected?.id === report.id} onSelect={openReport} />) : <div className="empty-state"><Search size={22} /><strong>No reports yet</strong><span>Approved community reports will appear here.</span></div>}</div>
          <div className="panel-footer"><span><Users size={15} /> Built with community input</span><button className="footer-link" onClick={() => setNotice('Community reports are visible only after authorized review. Verification is not government endorsement.')}><ShieldCheck size={14} /> Review standards</button></div>
        </aside>
        <ProvinceMap
          reports={filtered}
          theme={theme}
          categories={categories}
          counts={counts}
          category={category}
          onCategory={setCategory}
          area={area}
          selected={selected}
          onSelect={setSelected}
          focus={focus}
          picking={picking}
          onPick={pickPoint}
          onCancelPick={() => setPicking(false)}
          pickLocation={location}
          onStartReport={startReport}
          mappedCount={mappedCount}
          volunteerOpportunities={volunteerMapData.opportunities}
          volunteerSignupCounts={volunteerMapData.signupCounts}
          onVolunteerOpen={(opportunity, action) => {
            setVolunteerInitial({ id: opportunity.id, action });
            setView('volunteers');
          }}
          detail={selected ? <ReportDetailCard
            report={selected}
            categoryName={categoryNames[selected.category_slug] ?? selected.category_slug}
            markerColor={categoryVisual(selected.category_slug, theme).color}
            statusColorValue={statusColor(selected.status, theme)}
            decision={showSubmissions ? decisionText(selected) : undefined}
            onClose={() => setSelected(null)}
          /> : null}
        />
      </section>
      <ProvincePulse
        reports={reports}
        theme={theme}
        categories={categories}
        coverage={coverage}
        counts={counts}
        isStaff={isStaff}
        pending={pending}
        verified={verified}
        resolved={resolved}
        thisWeek={thisWeek}
        barangays={barangays}
        municipalityTotal={MUNICIPALITIES.length}
        category={category}
        area={area}
        onSelectCategory={setCategory}
        onSelectPlace={focusOnPlace}
      />
    </>}
    {notice && <div className="toast" role="status"><span><Check size={15} /></span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={14} /></button></div>}
    {formOpen && authMode && isSupabaseConfigured && <AuthDialog supabase={supabase} initialMode={authMode} onNotice={setNotice} onClose={() => { setFormOpen(false); setAuthMode(null); }} />}
    {(formOpen || picking) && !authMode && <ReportDialog categories={categories} onClose={() => { setFormOpen(false); setPicking(false); }} onSubmit={submitReport} onPickLocation={startPicking} location={location} hidden={picking} />}
    <footer className="site-footer"><span><HeartPulse size={14} /> A community-powered view of Eastern Samar</span><span>{isSupabaseConfigured ? 'Shared reports · moderation required' : 'Demo mode · map ready for live data'}</span></footer>
  </main>;
}

export default App;

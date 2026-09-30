import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import {
  Activity, ArrowDownUp, ArrowRight, CalendarDays, Check, ChevronDown,
  CircleHelp, Clock3, Compass, Filter, HeartPulse, Layers3, LogOut, MapPin,
  Menu, Plus, Inbox, Search, ShieldCheck, Trees, Users, X,
} from 'lucide-react';
import AuthDialog from './components/AuthDialog.jsx';
import ModeratorDashboard from './components/ModeratorDashboard.jsx';
import ReportDialog from './components/ReportDialog.jsx';
import { isSupabaseConfigured, supabase } from './lib/supabase.js';
import {
  createReport, fetchMyReports, fetchProfile, fetchProfiles, fetchPublicReports,
  fetchReportCategories, fetchReports, fetchEvidence, formatStatus, moderateReport,
  publicReportStatuses, reportStatuses, setProfileRole,
} from './lib/reports.js';

const municipalities = ['Arteche', 'Balangiga', 'Balangkayan', 'Borongan City', 'Can-avid', 'Dolores', 'General MacArthur', 'Giporlos', 'Guiuan', 'Hernani', 'Jipapad', 'Lawaan', 'Llorente', 'Maslog', 'Maydolong', 'Mercedes', 'Oras', 'Quinapondan', 'Salcedo', 'San Julian', 'San Policarpo', 'Sulat', 'Taft'];
const statusColors = {
  pending_review: '#d39829', under_review: '#5483a6', needs_more_information: '#8767c4',
  approved: '#438b64', verified: '#278d88', in_progress: '#438b64', resolved: '#738078', rejected: '#bd4d43',
};
const categoryColors = ['#e36e53', '#8767c4', '#d95f87', '#d5a33a', '#438b64', '#278d88', '#4d7f9d', '#ba7950', '#4b8f8d', '#7b8174'];

function categoryColor(category, categories) {
  const index = categories.findIndex((item) => item.slug === category);
  return categoryColors[index < 0 ? categoryColors.length - 1 : index % categoryColors.length];
}

function pinIcon(report, selected, categories) {
  return divIcon({ className: 'report-marker-shell', html: `<span class="report-marker${selected ? ' is-selected' : ''}" style="--marker-color:${categoryColor(report.category_slug, categories)}"><span></span></span>`, iconSize: [30, 38], iconAnchor: [15, 35], popupAnchor: [0, -31] });
}

function MapFocus({ report }) {
  const map = useMap();
  useEffect(() => {
    if (report?.latitude != null && report?.longitude != null) map.flyTo([report.latitude, report.longitude], Math.max(map.getZoom(), 11), { duration: 0.75 });
  }, [map, report]);
  return null;
}

function MapPicker({ enabled, onPick }) {
  useMapEvents({ click(event) { if (enabled) onPick(event.latlng); } });
  return null;
}

function Status({ value }) {
  return <span className="status-pill" style={{ '--status-color': statusColors[value] ?? '#738078' }}><i className="status-dot" />{formatStatus(value)}</span>;
}

function ReportRow({ report, categoryName, categoryMarkerColor, active, onSelect, decision }) {
  return <button className={`report-card${active ? ' is-active' : ''}`} onClick={() => onSelect(report)}>
    <i className="report-card-mark" style={{ '--category-color': categoryMarkerColor }} />
    <span className="report-card-content">
      <span className="report-card-topline"><span className="report-category">{categoryName}</span><span className="report-date">{new Date(report.created_at).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })}</span></span>
      <span className="report-title">{report.title}</span>
      <span className="report-place"><MapPin size={12} />{report.barangay ? `${report.barangay}, ` : ''}{report.municipality}</span>
      <span className="report-card-bottom"><Status value={report.status} /><span className="report-id">{report.priority}</span></span>
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
  const [loading, setLoading] = useState(isSupabaseConfigured);
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
  const sessionUserId = session?.user?.id;
  const isStaff = profile?.role === 'moderator' || profile?.role === 'admin';

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setLoadError(error.message);
      setSession(data?.session ?? null);
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
    if (!supabase) return undefined;
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
      .catch((error) => { if (active) setLoadError(error.message || 'We could not load your account profile.'); });
    return () => { active = false; };
  }, [sessionUserId]);

  useEffect(() => {
    if (profile?.role !== 'admin') return undefined;
    let active = true;
    fetchProfiles().then((result) => { if (active) setProfiles(result); }).catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [profile?.role]);

  const categoryNames = Object.fromEntries(categories.map((item) => [item.slug, item.name]));
  const placesWithReports = [...new Set(reports.map((report) => report.municipality))].sort();
  const filtered = reports.filter((report) => {
    const days = dateRange === '7' ? 7 : dateRange === '30' ? 30 : dateRange === '90' ? 90 : null;
    const haystack = `${report.title} ${report.description} ${report.municipality} ${report.barangay ?? ''}`.toLowerCase();
    return (category === 'all' || report.category_slug === category)
      && (area === 'all' || report.municipality === area)
      && (status === 'all' || report.status === status)
      && haystack.includes(query.toLowerCase())
      && (days === null || Date.parse(report.created_at) >= loadedAt - days * 86400000);
  });
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
    if (error) setNotice(error.message);
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
      <div className="topbar-center"><i className="live-indicator" /> Province-wide view <span className="topbar-divider">/</span> <span>Community reports</span></div>
      <div className="topbar-actions">
        {!isSupabaseConfigured && <span className="demo-label"><i /> Setup required</span>}
        {isStaff && <button className="outline-button review-nav-button" onClick={() => setView(view === 'review' ? 'map' : 'review')}>{view === 'review' ? 'Community map' : 'Review queue'}</button>}
        {session?.user ? <><span className="account-label">{profile?.display_name || session.user.email}</span><button className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></> : <button className="outline-button" disabled={!isSupabaseConfigured} onClick={() => { if (isSupabaseConfigured) { setAuthMode('sign-in'); setFormOpen(true); } else setNotice('Account access is unavailable until Supabase is configured.'); }}>Sign in</button>}
        <button className="primary-button top-report-button" onClick={startReport}><Plus size={16} /> Report a concern</button>
        <button className="icon-button mobile-menu" onClick={() => setPanelOpen((open) => !open)} aria-label="Toggle report panel"><Menu size={20} /></button>
      </div>
    </header>
    <section className="dashboard-heading" id="top"><div className="heading-copy"><span className="eyebrow">SEE THE PROBLEMS. MAP THE NEEDS. MOBILIZE THE COMMUNITY.</span><h1>{view === 'review' ? 'Community Review' : 'Community Action Map'}</h1><p>{view === 'review' ? 'Review submissions and coordinate next steps.' : 'Reported needs and local action across Eastern Samar.'}</p></div><div className="heading-meta"><div className="privacy-note"><ShieldCheck size={16} /><span>Community-reported<br /><strong>not official findings</strong></span></div><button className="text-button" onClick={() => setNotice('Public reports are visible only after authorized staff approve them. Private exact locations and evidence are restricted by database policies.')}><CircleHelp size={16} /> About this map</button></div></section>
    {!isSupabaseConfigured && <div className="connection-banner" role="note"><ShieldCheck size={16} /><span><strong>Setup required.</strong> Shared reports are unavailable until the Supabase URL and public anon key are configured for this deployment.</span></div>}
    {loadError && <div className="app-error" role="alert"><strong>Unable to load the shared platform.</strong><span>{loadError}</span><button className="outline-button" onClick={() => window.location.reload()}>Try again</button></div>}
    {view === 'review' && isStaff ? <ModeratorDashboard reports={queue} categories={categories} profiles={profiles} isAdmin={profile?.role === 'admin'} onModerate={reviewReport} onChangeRole={changeRole} onLoadEvidence={async (reportId) => { const result = await fetchEvidence(reportId); return result; }} /> : <>
      <section className="stats-strip" aria-label="Report summary">
        <div className="stat-item"><span className="stat-icon orange"><Activity size={17} /></span><div><span className="stat-value">{loading ? '…' : reports.length}</span><span className="stat-label">Community reports</span></div></div>
        <div className="stat-item"><span className="stat-icon green"><MapPin size={17} /></span><div><span className="stat-value">{placesWithReports.length}<small> / 23</small></span><span className="stat-label">Areas represented</span></div></div>
        <div className="stat-item"><span className="stat-icon blue"><Clock3 size={17} /></span><div><span className="stat-value">{isStaff ? pending : verified}</span><span className="stat-label">{isStaff ? 'Pending review' : 'Verified reports'}</span></div></div>
        <div className="stat-item"><span className="stat-icon violet"><Check size={17} /></span><div><span className="stat-value">{resolved}</span><span className="stat-label">Resolved reports</span></div></div>
      </section>
      <section className={`workspace${panelOpen ? ' panel-open' : ''}`}>
        <aside className="report-panel">
          <div className="panel-heading"><div><span className="eyebrow">COMMUNITY PULSE</span><h2>Reported concerns <span>{filtered.length}</span></h2></div><button className="icon-button mobile-close" onClick={() => setPanelOpen(false)} aria-label="Close report panel"><X size={18} /></button></div>
          <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports or places" aria-label="Search reports or places" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</div>
          <div className="filter-heading"><span><Filter size={14} /> Filters</span><button className="reset-button" onClick={clearFilters}>Reset</button></div>
          <div className="filters-grid">
            <label className="filter-select"><MapPin size={14} /><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Filter by municipality"><option value="all">All areas</option>{municipalities.map((place) => <option key={place}>{place}</option>)}</select><ChevronDown size={13} /></label>
            <label className="filter-select"><Layers3 size={14} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select><ChevronDown size={13} /></label>
            <label className="filter-select"><Activity size={14} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option>{statusOptions.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select><ChevronDown size={13} /></label>
            <label className="filter-select"><CalendarDays size={14} /><select value={dateRange} onChange={(event) => setDateRange(event.target.value)} aria-label="Filter by date"><option value="all">Any time</option><option value="7">Past 7 days</option><option value="30">Past 30 days</option><option value="90">Past 90 days</option></select><ChevronDown size={13} /></label>
          </div>
          <div className="list-toolbar"><span>{listCountLabel}</span>{sessionUserId && <button className={`sort-button${showSubmissions ? ' is-active' : ''}`} onClick={() => setShowSubmissions((open) => !open)}><Inbox size={13} /> {showSubmissions ? 'Community feed' : submissionsLabel}</button>}<button className="sort-button" onClick={() => setReports((current) => [...current].sort((first, second) => second.created_at.localeCompare(first.created_at)))}><ArrowDownUp size={13} /> Recent</button></div>
          <div className="report-list">{loading ? <div className="empty-state"><Search size={22} /><strong>Loading reports…</strong></div> : showSubmissions ? (myReports.length ? myReports.map((report) => <ReportRow key={report.id} report={report} decision={decisionText(report)} categoryName={categoryNames[report.category_slug] ?? report.category_slug} categoryMarkerColor={categoryColor(report.category_slug, categories)} active={selected?.id === report.id} onSelect={setSelected} />) : <div className="empty-state"><Inbox size={22} /><strong>No submissions yet</strong><span>Reports you send appear here with their review status.</span></div>) : filtered.length ? filtered.map((report) => <ReportRow key={report.id} report={report} categoryName={categoryNames[report.category_slug] ?? report.category_slug} categoryMarkerColor={categoryColor(report.category_slug, categories)} active={selected?.id === report.id} onSelect={setSelected} />) : <div className="empty-state"><Search size={22} /><strong>No reports yet</strong><span>Approved community reports will appear here.</span></div>}</div>
          <div className="panel-footer"><span><Users size={15} /> Built with community input</span><button className="footer-link" onClick={() => setNotice('Community reports are visible only after authorized review. Verification is not government endorsement.')}><ShieldCheck size={14} /> Review standards</button></div>
        </aside>
        <section className="map-stage" aria-label="Interactive map of Eastern Samar">
          <div className="map-topline"><div className="map-location"><span className="map-location-mark"><MapPin size={15} /></span><span><strong>Eastern Samar</strong><small>Eastern Visayas, Philippines</small></span></div><div className="map-top-actions"><span className="map-count"><i /> {filtered.filter((report) => report.latitude != null && report.longitude != null).length} mapped</span><button className="map-tool-button" onClick={startReport}><Plus size={15} /> Add report</button></div></div>
          {picking && <div className="map-pick-banner"><MapPin size={16} /> Click the map to place the report pin <button onClick={() => setPicking(false)}>Cancel</button></div>}
          <MapContainer center={[11.55, 125.45]} zoom={8} minZoom={7} maxZoom={17} scrollWheelZoom className="leaflet-map" zoomControl={false}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFocus report={selected} /><MapPicker enabled={picking} onPick={pickPoint} />
            {filtered.filter((report) => report.latitude != null && report.longitude != null).map((report) => <Marker key={report.id} position={[report.latitude, report.longitude]} icon={pinIcon(report, selected?.id === report.id, categories)} eventHandlers={{ click: () => setSelected(report) }}><Popup><div className="popup-card"><span className="popup-category" style={{ color: categoryColor(report.category_slug, categories) }}>{categoryNames[report.category_slug] ?? report.category_slug}</span><strong>{report.title}</strong><span>{report.barangay ? `${report.barangay}, ` : ''}{report.municipality}</span><Status value={report.status} /><small>Submitted {new Date(report.created_at).toLocaleDateString('en-PH')}</small></div></Popup></Marker>)}
          </MapContainer>
          <div className="map-legend"><div className="legend-head"><span>Issue categories</span><span className="legend-tag">{categories.length}</span></div><div className="legend-items">{categories.map((item, index) => <button className={`legend-item${category === item.slug ? ' is-active' : ''}`} key={item.slug} onClick={() => setCategory(category === item.slug ? 'all' : item.slug)}><i style={{ '--legend-color': categoryColors[index % categoryColors.length] }} /><span>{item.name}</span></button>)}</div></div>
          <div className="map-attribution-note"><Trees size={13} /> Map data © OpenStreetMap contributors</div><div className="map-status-key"><span><i className="key-verified" />Reviewed</span><span><i className="key-unverified" />Pending review</span></div>
        </section>
      </section>
    </>}
    {notice && <div className="toast" role="status"><span><Check size={15} /></span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={14} /></button></div>}
    {formOpen && authMode && isSupabaseConfigured && <AuthDialog supabase={supabase} initialMode={authMode} onNotice={setNotice} onClose={() => { setFormOpen(false); setAuthMode(null); }} />}
    {(formOpen || picking) && !authMode && <ReportDialog categories={categories} onClose={() => { setFormOpen(false); setPicking(false); }} onSubmit={submitReport} onPickLocation={startPicking} location={location} hidden={picking} />}
    <footer className="site-footer"><span><HeartPulse size={14} /> A community-powered view of Eastern Samar</span><span>{isSupabaseConfigured ? 'Shared reports · moderation required' : 'Setup required · reports unavailable'}</span></footer>
  </main>;
}

export default App;

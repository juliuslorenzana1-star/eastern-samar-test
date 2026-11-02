import { t, locale, languageCode } from './i18n/config.js';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, CalendarDays, Check, ChevronDown,
  Compass, Filter, HeartPulse, Inbox, Layers3, MapPin,
  Plus, Search, ShieldCheck, Users, WifiOff, X,
} from 'lucide-react';
import AuthDialog from './components/AuthDialog.jsx';
import LanguageSelector from './components/LanguageSelector.jsx';
import CollectionStatus from './components/CollectionStatus.jsx';
import { personalDataCollectionEnabled, visitorReportingEnabled } from './lib/collection-policy.js';
import { submitVisitorReport } from './lib/visitor-reports.js';
import ReportTracking from './components/ReportTracking.jsx';
import EmergencyHotlineDrawer from './components/EmergencyHotlineDrawer.jsx';
import ProvincePulse from './components/ProvincePulse.jsx';
import ReportDialog from './components/ReportDialog.jsx';
import ReportDetailCard from './components/ReportDetailCard.jsx';
import CivicOverview from './components/CivicOverview.jsx';
import ResidentProfile from './components/ResidentProfile.jsx';
import ReportReceipt from './components/ReportReceipt.jsx';
import ReportDetailsDialog from './components/ReportDetailsDialog.jsx';
import { distanceKm } from './lib/distance.js';
import useDialogFocus from './lib/useDialogFocus.js';
import ReportTrends from './components/ReportTrends.jsx';
import NetworkStatus from './components/NetworkStatus.jsx';
import { finishWelcome, needsWelcome } from './lib/onboarding.js';
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
import { getOfflineDrafts, removeOfflineDraft, syncOfflineDrafts } from './lib/offline-drafts.js';

const ModeratorDashboard = lazy(() => import('./components/ModeratorDashboard.jsx'));
const ProvinceMap = lazy(() => import('./components/ProvinceMap.jsx'));
const CommunityRecognition = lazy(() => import('./components/CommunityRecognition.jsx'));
const VolunteerBoard = lazy(() => import('./components/VolunteerBoard.jsx'));
const SmartEsteWelcome = lazy(() => import('./components/SmartEsteWelcome.jsx'));

export function Status({ value, theme = 'light' }) {
  useTranslation();
  return <span className="status-pill" style={{ '--status-color': statusColor(value, theme) }}><i className="status-dot" />{formatStatus(value)}</span>;
}

function ReportRow({ report, theme, categoryName, active, onSelect, decision }) {
  useTranslation();
  const { color } = categoryVisual(report.category_slug, theme);
  return <button className={`report-card${active ? ' is-active' : ''}`} onClick={() => onSelect(report)}>
    <i className="report-card-mark" style={{ '--category-color': color }} />
    <span className="report-card-content">
      <span className="report-card-topline"><span className="report-category">{t(categoryName)}</span><span className="report-date">{new Date(report.created_at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</span></span>
      <span className="report-title">{report.title}</span>
      <span className="report-place"><MapPin size={12} />{placeLine(report)}</span>
      <span className="report-card-bottom"><Status value={report.status} theme={theme} /><span className={`report-priority is-${report.priority}`}>{t(report.priority)}</span></span>
      {decision && <span className="report-decision">{decision}</span>}
    </span><ArrowRight className="report-arrow" size={15} />
  </button>;
}

// The plain-language outcome shown under a resident's own submission when a
// moderator left no written reason.
function decisionText(report) {
  if (report.decision_note) return report.decision_note;
  if (report.status === 'pending_review') return t('Waiting for a moderator to review this report.');
  if (report.status === 'under_review') return t('A moderator is looking into this report.');
  if (report.status === 'rejected') return t('This report was not approved for the public map.');
  if (report.status === 'approved') return t('Approved and published on the community map.');
  return null;
}

function App() {
  useTranslation();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [profileVersion,setProfileVersion] = useState(0);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [queue, setQueue] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [myReportsError, setMyReportsError] = useState('');
  const [myReportsRetrying, setMyReportsRetrying] = useState(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [loadError, setLoadError] = useState('');
  const [category, setCategory] = useState('all');
  const [area, setArea] = useState('all');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [olderBusy, setOlderBusy] = useState(false);
  const [olderExhausted, setOlderExhausted] = useState(false);
  const [listLimit, setListLimit] = useState(30);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [location, setLocation] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [authMode, setAuthMode] = useState(null);
  const [view, setView] = useState(() => window.location.hash === '#recognition' ? 'recognition' : 'map');
  const [navigationTarget, setNavigationTarget] = useState('map');
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [trackingOpen,setTrackingOpen]=useState(false);
  const [nearby, setNearby] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const fullscreenRef = useDialogFocus({ active: fullscreenMap, onClose: () => { setFullscreenMap(false); if (picking) { setPicking(false); setFormOpen(true); } } });
  const [loadedAt] = useState(() => Date.now());
  const [themeMode, setThemeMode] = useState(() => readStoredThemeMode());
  const [systemTick, setSystemTick] = useState(0);
  const [focus, setFocus] = useState(null);
  const focusNonce = useRef(0);
  const [volunteerMapData, setVolunteerMapData] = useState({ opportunities: [], signupCounts: {} });
  const [volunteerInitial, setVolunteerInitial] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeTour, setWelcomeTour] = useState(null);
  const [hotlinesOpen, setHotlinesOpen] = useState(false);
  const [, setOfflineDraftCount] = useState(0);
  const [syncingDrafts, setSyncingDrafts] = useState(false);

  const sessionUserId = session?.user?.id;
  const authUserRef = useRef(null);
  const offlineDraftCount = getOfflineDrafts(sessionUserId || null).length;

  // Track offline drafts changes
  useEffect(() => {
    function handleDraftsChanged() {
      setOfflineDraftCount((revision) => revision + 1);
    }
    window.addEventListener('smart_este_drafts_changed', handleDraftsChanged);
    return () => window.removeEventListener('smart_este_drafts_changed', handleDraftsChanged);
  }, []);

  // The signup metadata survives an email-confirmation redirect or a different
  // device. Completion is remembered per account on this browser.
  useEffect(() => {
    const user = session?.user;
    if (welcomeTour || formOpen || authMode === 'update' || !needsWelcome(user)) return undefined;
    const entry = document.querySelector('.entry-application');
    const show = () => {
      if (entry?.hasAttribute('inert')) return;
      setWelcomeTour({ userId: user.id, name: user.user_metadata?.display_name || '', needsConfirmation: false });
    };
    const observer = new MutationObserver(show);
    if (entry) observer.observe(entry, { attributes: true, attributeFilter: ['inert'] });
    show();
    return () => observer.disconnect();
  }, [session?.user, formOpen, authMode, welcomeTour]);

  const openedEmailLink = useRef('');
  const handleEmailLink = useEffectEvent(() => {
    if (window.location.hash === '#recognition') { setView('recognition'); return; }
    const hash = window.location.hash.slice(1);
    if (!hash || openedEmailLink.current === hash) return;
    const params = new URLSearchParams(hash);
    const activityId = params.get('volunteer');
    if (activityId && /^[0-9a-f-]{36}$/i.test(activityId)) {
      openedEmailLink.current = hash;
      setVolunteerInitial({ id: activityId, action: false });
      setNavigationTarget('volunteers');
      setView('volunteers');
    }
    const submissionId = params.get('submission');
    if (!submissionId) return;
    if (!sessionUserId) { setNotice('Sign in to view your submitted concern.'); return; }
    const report = myReports.find(({ id }) => id === submissionId);
    if (!report) return;
    openedEmailLink.current = hash;
    setNavigationTarget('submissions'); setView('map'); setShowSubmissions(true); setPanelOpen(true); setSelected(report);
  });
  useEffect(() => {
    const sync = () => handleEmailLink();
    const timer = window.setTimeout(sync,0);
    window.addEventListener('hashchange',sync);
    return () => { window.clearTimeout(timer); window.removeEventListener('hashchange',sync); };
  }, [myReports, sessionUserId]);

  const isStaff = profile?.id === sessionUserId && (profile?.role === 'moderator' || profile?.role === 'admin');
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
    if (!welcomeMessage) return undefined;
    const timeoutId = window.setTimeout(() => setWelcomeMessage(''), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [welcomeMessage]);

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
    let authChanged = false;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authChanged) return;
      if (error) {
        setLoadError('We could not restore your sign-in session. Check your connection and try again.');
        return;
      }
      setSession(data?.session ?? null);
    }).catch(() => {
      if (active) setLoadError('We could not restore your sign-in session. Check your connection and try again.');
    }).finally(() => { if(active) setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authChanged = true;
      setAuthLoading(false);
      if (event === 'TOKEN_REFRESHED') { setProfile(null); setProfileVersion(value=>value+1); }
      if (authUserRef.current !== nextSession?.user?.id) {
        authUserRef.current = nextSession?.user?.id;
        setProfile(null); setProfiles([]); setQueue([]); setMyReports([]);
        setSelected(null); setShowSubmissions(false);
      }
      setSession(nextSession);
      if (!nextSession) {
        setWelcomeMessage('');
        setSelected(null);
        setProfile(null);
        setProfiles([]);
        setMyReports([]);
        setMyReportsError('');
        setShowSubmissions(false);
        setView(current => current === 'recognition' ? current : 'map');
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
      return undefined;
    }
    let active = true;
    Promise.allSettled([
      fetchPublicReports(),
      fetchReportCategories(),
      sessionUserId ? fetchMyReports(sessionUserId) : Promise.resolve([]),
    ])
      .then(([reportResult, categoryResult, myResult]) => {
        if (!active) return;
        if (reportResult.status === 'fulfilled') setReports(reportResult.value);
        if (categoryResult.status === 'fulfilled') setCategories(categoryResult.value);
        if (myResult.status === 'fulfilled') { setMyReports(myResult.value); setMyReportsError(''); }
        else { setMyReportsError(myResult.reason?.message || 'Your submissions could not be loaded. Please try again.'); }
        setLoadError(reportResult.status === 'rejected' || categoryResult.status === 'rejected' ? 'Community reports or categories could not be loaded. Check your connection and try again.' : '');
      })
      .catch((error) => { if (active) setLoadError(error.message || 'We could not load community reports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionUserId]);

  // The moderation queue is a separate request that only runs for staff. Residents
  // never issue it, so a pending submission can never reach the map state.
  useEffect(() => {
    if (!isStaff) return undefined;
    let active = true;
    fetchReports().then((data) => { if (active) setQueue(data); }).catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [isStaff]);

  useEffect(() => {
    if (!sessionUserId) return undefined;
    let active = true;
    fetchProfile(sessionUserId)
      .then((nextProfile) => { if (active) { setProfile(nextProfile); if (!['moderator','admin'].includes(nextProfile?.role)) setQueue([]); } })
      .catch(() => { if (active) setLoadError('Your account profile could not be loaded. Refresh and try again.'); });
    return () => { active = false; };
  }, [sessionUserId,profileVersion]);

  useEffect(() => {
    if (!sessionUserId) return undefined;
    let active=true;
    const refresh=async()=> {
      if(document.hidden || !navigator.onLine) return;
      try {
        const own=await fetchMyReports(sessionUserId);
        if(active) {setMyReports(own);setMyReportsError('');}
      }catch(error){if(active)setMyReportsError(error.message || 'Your submissions could not refresh.');}
    };
    const interval=window.setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);
    return ()=> {active=false;window.clearInterval(interval);document.removeEventListener('visibilitychange',refresh);};
  },[sessionUserId]);

  useEffect(() => {
    if (profile?.role !== 'admin') return undefined;
    let active = true;
    fetchProfiles().then((result) => { if (active) setProfiles(result); }).catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [profile?.role]);

  const categoryNames = Object.fromEntries(categories.map((item) => [item.slug, item.name]));
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!supabase || document.hidden || !navigator.onLine) return;
      try {
        const next = await fetchPublicReports();
        if (active) {
          setReports(next);
          setOlderExhausted(next.length < 500);
        }
      } catch { /* Keep the last successful data on a transient background error. */ }
    };
    const interval = window.setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);
    return () => {active=false;window.clearInterval(interval);document.removeEventListener('visibilitychange',refresh);};
  }, []);

  async function loadOlderReports() {
    if (olderBusy) return;
    setOlderBusy(true);
    try {
      const older = await fetchPublicReports({offset:reports.length});
      setReports(current => [...current,...older.filter(report=>!current.some(item=>item.id===report.id))]);
      setOlderExhausted(older.length < 500);
    } catch {setNotice('Older reports could not be loaded. Check your connection and try again.');}
    finally {setOlderBusy(false);}
  }
  // Local figures are derived from the reports already in memory — no extra
  // queries, and nothing is padded with estimates.
  const places = useMemo(() => placeOptions(reports), [reports]);
  const categoryBase = useMemo(() => reports.filter((report) => {
    const days = dateRange === '7' ? 7 : dateRange === '30' ? 30 : dateRange === '90' ? 90 : null;
    const haystack = `${report.title} ${report.description} ${report.municipality} ${report.barangay ?? ''}`.toLowerCase();
    return (area === 'all' || report.municipality === area)
      && (status === 'all' || report.status === status)
      && haystack.includes(query.toLowerCase())
      && (days === null || Date.parse(report.created_at) >= loadedAt - days * 86400000)
      && (!nearby || distanceKm(nearby, report) <= 10);
  }), [area, dateRange, loadedAt, query, reports, status, nearby]);
  const filtered = useMemo(() => category === 'all'
    ? categoryBase
    : categoryBase.filter((report) => report.category_slug === category), [category, categoryBase]);
  const filteredMyReports = useMemo(() => myReports.filter(report => {
    const days = dateRange === 'all' ? null : Number(dateRange);
    return (area === 'all' || report.municipality === area)
      && (category === 'all' || report.category_slug === category)
      && (status === 'all' || report.status === status)
      && `${report.title} ${report.description} ${report.municipality} ${report.barangay || ''}`.toLowerCase().includes(query.toLowerCase())
      && (days === null || Date.parse(report.created_at) >= loadedAt - days * 86400000);
  }), [myReports, area, category, status, query, dateRange, loadedAt]);
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
  const statusOptions = isStaff || showSubmissions ? reportStatuses : publicReportStatuses;
  const listCountLabel = showSubmissions
    ? t(filteredMyReports.length === 1 ? '{{count}} submission' : '{{count}} submissions', { count: filteredMyReports.length })
    : t(filtered.length === 1 ? '{{count}} report' : '{{count}} reports', { count: filtered.length });

  // Refresh all three data sets independently so a staff-queue failure does not
  // discard freshly loaded public reports or own submissions.
  async function reloadReports() {
    const [publicResult, myResult, queueResult] = await Promise.allSettled([
      fetchPublicReports(),
      sessionUserId ? fetchMyReports(sessionUserId) : Promise.resolve([]),
      isStaff ? fetchReports() : Promise.resolve([]),
    ]);
    if (publicResult.status === 'fulfilled') setReports(publicResult.value);
    if (myResult.status === 'fulfilled') { setMyReports(myResult.value); setMyReportsError(''); }
    else if (myResult.status === 'rejected') setMyReportsError(myResult.reason?.message || 'Your submissions could not be refreshed.');
    if (queueResult.status === 'fulfilled') setQueue(queueResult.value);
    // Re-throw only if the public data failed so callers that depend on a fresh
    // public list know the reload did not fully succeed.
    if (publicResult.status === 'rejected') throw publicResult.reason;
  }

  function clearFilters() { setCategory('all'); setArea('all'); setStatus('all'); setDateRange('all'); setQuery(''); setNearby(null); setLocationError(''); }
  function findNearby() {
    if (!navigator.geolocation) { setLocationError('Location is unavailable in this browser. Choose a municipality using the filters instead.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(position => {
      setNearby({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setShowSubmissions(false); setLocating(false);
    }, () => { setLocating(false); setLocationError('Location could not be obtained. Allow location access or select a municipality in the filters.'); }, { timeout: 12000, maximumAge: 60000 });
  }
  // A place is picked from the pulse list or a search suggestion: the map moves
  // to the centroid of the points actually stored for that place, nothing guessed.
  function focusOnPlace(place) {
    if (!place?.focus) return;
    if (place.type !== 'barangay' && place.municipality) setArea(place.municipality);
    setFocus({ latlng: place.focus, zoom: place.type === 'barangay' ? 13 : 11, nonce: ++focusNonce.current });
    if (window.innerWidth <= 900 && !['reports', 'submissions'].includes(navigationTarget)) setPanelOpen(false);
  }
  function openReport(report) {
    setSelected(report);
    if (hasCoordinates(report)) setFocus({ latlng: [Number(report.latitude), Number(report.longitude)], zoom: 14, nonce: ++focusNonce.current });
    if (window.innerWidth <= 900 && !['reports', 'submissions'].includes(navigationTarget)) setPanelOpen(false);
  }
  function startReport() {
    if (!personalDataCollectionEnabled && !visitorReportingEnabled) { setAuthMode('sign-in'); setFormOpen(true); return; }
    if (!isSupabaseConfigured) { setNotice('The shared database is not configured, so reports cannot be accepted yet.'); return; }
    if (!visitorReportingEnabled && !session?.user) { setAuthMode('sign-in'); setFormOpen(true); setNotice('Sign in to submit a report.'); return; }
    setAuthMode(null);
    setLocation(null); setFormOpen(true); setPanelOpen(false); setNavigationTarget('map'); setView('map');
  }
  function startPicking() { setFullscreenMap(true); setPicking(true); setFormOpen(false); setNotice('Click the map to place the report pin.'); }
  function pickPoint(point) { setLocation({ lat: point.lat, lng: point.lng }); setPicking(false); setFullscreenMap(false); setFormOpen(true); setNotice('Location added to the report.'); }

  async function submitReport(values) {
    if(visitorReportingEnabled && !values.useAccount){
      const saved=await submitVisitorReport(values,values.trackingCredential);
      setReceipt(saved);setSelected(null);return;
    }
    const { report, warning, warningMessages } = await createReport(values, session?.user?.id);
    // A successful insert must never be presented as a failed submission when
    // a subsequent refresh fails: retrying would create a second report.
    setMyReports((current) => [report, ...current.filter(({ id }) => id !== report.id)]);
    setMyReportsError('');
    let refreshWarning = '';
    try { await reloadReports(); } catch { refreshWarning = ' Report saved, but the list could not refresh. Please refresh later to see updates.'; }
    // The new report is not on the public map yet, so do not focus it there —
    // send the resident to their own submission list instead.
    setSelected(null);
    setShowSubmissions(true);
    setPanelOpen(true);
    setNavigationTarget('submissions');
    setReceipt(report);
    setNotice([...(warningMessages?.length ? warningMessages : [warning || 'Report submitted and saved securely. Track it under My submissions — it appears on the map once a moderator approves it.']), refreshWarning.trim()].filter(Boolean));
  }

  async function handleSyncOfflineDrafts() {
    if (syncingDrafts) return;
    setSyncingDrafts(true);
    try {
      const { synced, failed } = await syncOfflineDrafts(submitReport, sessionUserId || null);
      if (synced > 0) {
        setNotice(t("Successfully uploaded {{value1}} offline report{{value2}}!", { value1: synced, value2: synced > 1 ? 's' : '' }));
      }
      if (failed > 0) {
        setNotice(t("{{value1}} draft{{value2}} could not sync. Check connection.", { value1: failed, value2: failed > 1 ? 's' : '' }));
      }
      setOfflineDraftCount(getOfflineDrafts().length);
    } catch (err) {
      setNotice(err.message || 'Offline sync failed.');
    } finally {
      setSyncingDrafts(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setNotice('We could not sign you out. Please try again.');
    else { if (view !== 'recognition') navigate('profile'); setNotice('You have signed out.'); }
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

  function navigate(destination, fromHistory = false) {
    if (!fromHistory && destination !== 'report') window.history.pushState(null, '', `#${destination}`);
    if (window.location.hash === '#recognition') window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (destination === 'report') { startReport(); return; }
    if (destination === 'submissions' && !sessionUserId) {
      if (isSupabaseConfigured) { setAuthMode('sign-in'); setFormOpen(true); }
      else setNotice('Account access is unavailable until the shared database is connected.');
      return;
    }
    setNavigationTarget(destination);
    setSelected(null);
    setView(destination === 'activities' ? 'volunteers' : ['volunteers', 'review'].includes(destination) ? destination : 'map');
    setShowSubmissions(destination === 'submissions');
    setPanelOpen(['reports', 'submissions'].includes(destination));
    setFullscreenMap(false);
    window.requestAnimationFrame(() => {
      if (['map', 'profile', 'volunteers', 'activities', 'about', 'review'].includes(destination)) { window.scrollTo({ top: 0, behavior: 'auto' }); return; }
      const target = destination === 'impact' ? 'community-impact' : destination === 'reports' || destination === 'submissions' ? 'community-reports' : 'explore-map';
      document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }

  const restoreNavigation = useEffectEvent(() => {
    const destination = window.location.hash.slice(1);
    if (['map', 'reports', 'volunteers', 'activities', 'profile', 'submissions', 'impact', 'about', 'review'].includes(destination)) navigate(destination, true);
    else if (!destination) navigate('map', true);
  });
  useEffect(() => {
    if (authLoading) return undefined;
    const frame = requestAnimationFrame(() => restoreNavigation());
    const restore = () => restoreNavigation();
    window.addEventListener('popstate', restore);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('popstate', restore); };
  }, [authLoading, sessionUserId]);

  async function welcomeAfterLogin(user) {
    if (!user) return;
    let name = '';
    try { name = (await fetchProfile(user.id))?.display_name?.trim().split(/\s+/)[0] || ''; } catch { /* Use a neutral greeting when the profile is unavailable. */ }
    setWelcomeMessage(name ? t("Welcome back, {{value1}}!", { value1: name }) : 'Welcome back!');
  }

  function closeWelcomeTour(destination) {
    finishWelcome(welcomeTour?.userId);
    setNotice('');
    setWelcomeTour(null);
    if (destination) window.requestAnimationFrame(() => navigate(destination));
  }

  function exploreWelcomeFeature(destination) {
    setNotice('');
    setWelcomeTour((current) => ({ ...current, exploring: true }));
    window.requestAnimationFrame(() => navigate(destination));
  }

  function resumeWelcomeTour() {
    setFormOpen(false);
    setAuthMode(null);
    setWelcomeTour((current) => ({ ...current, exploring: false }));
  }

  async function retryMyReports() {
    if (!sessionUserId || myReportsRetrying) return;
    setMyReportsRetrying(true);
    try { setMyReports(await fetchMyReports(sessionUserId)); setMyReportsError(''); }
    catch (error) { setMyReportsError(error.message); }
    finally { setMyReportsRetrying(false); }
  }

  const activeNavigation = view === 'recognition' ? 'volunteers' : view === 'volunteers' || view === 'review' ? view : showSubmissions ? 'reports' : navigationTarget;
  const appliedFilterCount = [area, category, status, dateRange].filter((value) => value !== 'all').length;
  const ReportHeading = ['reports', 'submissions'].includes(navigationTarget) ? 'h1' : 'h2';

  return <main data-destination={navigationTarget} className={`app-shell${view === 'map' ? ' is-map-view' : ''}${fullscreenMap ? ' is-fullscreen-map' : ''}`}>
    <a className="skip-link" href={navigationTarget === 'profile' ? '#profile-title' : '#explore-map'}>{t("Skip to content")}</a>
    <header className="topbar">
      <a className="brand" href="#map" onClick={event => { event.preventDefault(); navigate('map'); }} aria-label={t("Eastern Samar Community Action Map home")}><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}community-mark.svg`} width="40" height="40" alt="" /></span><span className="brand-copy"><strong>{t("SMART ESTE")}</strong><span>{t("EASTERN SAMAR")}</span></span></a>
      <nav className="desktop-navigation" id="primary-navigation" aria-label={t("Community platform")}>
        {[['map', 'Map'], ['reports', 'Reports'], ['volunteers', 'Volunteer'], ['impact', 'Community'], ['about', 'About']].map(([target, label]) => <button key={target} aria-current={activeNavigation === target ? 'page' : undefined} onClick={() => navigate(target)}>{t(label)}</button>)}
      </nav>
      <div className="topbar-actions">
        <LanguageSelector compact />
        <button className="header-search" aria-label={t("Search reports and places")} onClick={() => { navigate('reports'); requestAnimationFrame(() => document.querySelector('.search-box input')?.focus()); }}><Search size={18} /><span>{t("Search your community")}</span></button>
        <button className="icon-button header-profile" aria-label={t("Open profile")} aria-busy={authLoading} onClick={() => navigate('profile')}><ShieldCheck size={21} /></button>
        <span className="header-account">{sessionUserId ? profile?.display_name || t("My account") : t("Resident access")}</span>
      </div>
    </header>
    <NetworkStatus />
    <CollectionStatus />
    {visitorReportingEnabled && <button className="outline-button" onClick={()=>setTrackingOpen(true)}>{t('Track a report')}</button>}
    <section className="dashboard-heading" id="top">
      <div className="heading-copy">
        <span className="eyebrow"><MapPin size={14} />  {t("EASTERN SAMAR · TOGETHER, WE CAN")}</span>
        <h1 className={languageCode() === 'war' ? 'language-welcome' : undefined} id={view === 'volunteers' ? 'volunteer-title' : undefined}>{view === 'recognition' ? t("Community Recognition") : view === "review" ? t("Help local action move forward.") : view === 'volunteers' ? t("A little time. A local difference.") : languageCode() === 'war' ? t('Welcome to Eastern Samar Community Action Map!') : <>{t("Your Community.")}<br />{t("Your Voice.")} <em>{t("Our Action.")}</em></>}</h1>
        <p>{view === 'volunteers' ? t("Find an activity, lend your skills, and be part of something close to home.") : languageCode() === 'war' ? t('Your voice matters. Report concerns in your community and join activities for the progress of Eastern Samar.') : t("Report local concerns, volunteer, and help build a safer, cleaner, and more resilient Eastern Samar.")}</p>
        <div className="hero-actions"><button className="primary-button" onClick={startReport}><Plus size={20} />{t("Report a Concern")}<ArrowRight size={18} /></button><button className="outline-button" onClick={() => navigate(languageCode() === 'war' ? 'map' : 'volunteers')}><Users size={19} />{languageCode() === 'war' ? t('View the Map') : t("Join as Volunteer")}</button></div>
      </div>
      {!loading && !loadError && reports.length > 0 ? <section className="hero-impact" aria-label={t("Loaded community impact")}><span className="eyebrow">{t("LOCAL VOICES. SHARED PROGRESS.")}</span><dl><div><dt>{t("Published reports")}</dt><dd>{reports.length}</dd></div><div><dt>{t("Municipalities reached")}</dt><dd>{new Set(reports.map(report => report.municipality).filter(Boolean)).size}</dd></div><div><dt>{t("Resolved")}</dt><dd>{reports.filter(report => report.status === 'resolved').length}</dd></div></dl><small>{t("Based on public reports loaded in this session.")}</small></section> : <div className="hero-note"><span>{t("LOCAL VOICES. SHARED PROGRESS.")}</span><p>{t("Small actions.")}<br />{t("Stronger communities.")}</p><span>{t("For every barangay. For every Estehanon.")}</span></div>}
    </section>
    {loadError && <div className="app-error" role="alert"><strong>{t("Unable to load the shared platform.")}</strong><span>{t(loadError)}</span><button className="outline-button" onClick={() => window.location.reload()}>{t("Try again")}</button></div>}
    {view === "map" && ['about', 'impact'].includes(navigationTarget) && <header className="page-intro"><span className="eyebrow">{t("SMART ESTE · EASTERN SAMAR")}</span><h1>{navigationTarget === "about" ? t("Local voices. Meaningful action.") : t("Community impact")}</h1><p>{navigationTarget === "about" ? t("A community service platform for raising concerns, following local progress, and volunteering close to home.") : t("Explore progress from the published reports loaded in this session. Current map filters apply.")}</p></header>}
    {view === "map" && navigationTarget === "about" && <CivicOverview staff={isStaff} reports={reports} activities={volunteerMapData.opportunities} onReport={startReport} onMap={() => navigate('map')} onVolunteer={() => navigate('volunteers')} />}
    {view === "map" && navigationTarget === "profile" && <ResidentProfile user={session?.user} profile={profile} isStaff={isStaff} themeMode={themeMode} onTheme={chooseThemeMode} onNavigate={navigate} onSignIn={() => { if (isSupabaseConfigured) { setAuthMode('sign-in'); setFormOpen(true); } else setNotice('Account access is unavailable until the shared database is connected.'); }} onSignOut={signOut} onHotlines={() => setHotlinesOpen(true)} />}
    <Suspense fallback={<section className="view-loading" role="status"><Compass size={22} /><strong>{t('Opening {{section}}…', { section: view === 'review' ? t('administration') : t('volunteer opportunities') })}</strong><span>{t('The community map will be ready when you return.')}</span></section>}>
    {view === 'recognition' ? <CommunityRecognition userId={sessionUserId} onBack={() => navigate('volunteers')} onSignIn={() => { setAuthMode('sign-in'); setFormOpen(true); }} /> : view === 'volunteers' ? <VolunteerBoard
      key={navigationTarget === 'activities' ? 'my-activities' : 'opportunities'}
      initialView={navigationTarget === 'activities' ? 'my-activities' : 'opportunities'}
      configured={isSupabaseConfigured}
      userId={sessionUserId}
      theme={theme}
      reports={reports}
      onSignIn={(mode = 'sign-in') => {
        if (!isSupabaseConfigured) { setNotice('Account access is unavailable while the shared database is disconnected.'); return; }
        setAuthMode(mode);
        setFormOpen(true);
      }}
      onMap={() => navigate('map')}
      onOpenReport={(report) => { navigate('map'); openReport(report); }}
      onDataLoaded={updateVolunteerMapData}
      onShowOnMap={(opportunity) => {
        navigate('map');
        setSelected(null);
        if (hasCoordinates(opportunity)) setFocus({ latlng: [Number(opportunity.latitude), Number(opportunity.longitude)], zoom: 14, nonce: ++focusNonce.current });
        setView('map');
      }}
      initialOpportunityId={volunteerInitial?.id}
      initialAction={volunteerInitial?.action}
      onOpportunityOpened={clearVolunteerInitial}
    /> : view === "review" && isStaff ? <ModeratorDashboard reports={queue} categories={categories} profiles={profiles} isAdmin={profile?.role === 'admin'} currentUserId={sessionUserId} onModerate={reviewReport} onChangeRole={changeRole} onLoadEvidence={async (reportId) => { const result = await fetchEvidence(reportId); return result; }} onLoadAIReview={fetchAIReview} onCreateVolunteerOpportunity={createVolunteerOpportunity} onUpdateVolunteerOpportunity={updateVolunteerOpportunity} onLoadVolunteerManagement={fetchVolunteerManagementOverview} onLoadVolunteerRegistrations={fetchOpportunityRegistrations} onUpdateVolunteerRegistration={updateVolunteerRegistration} onUpdateVolunteerOpportunityStatus={updateVolunteerOpportunityStatus} onSetVolunteerRegistrationOpen={setVolunteerRegistrationOpen} /> : <>
      <section ref={fullscreenRef} tabIndex={fullscreenMap ? -1 : undefined} role={fullscreenMap ? 'dialog' : undefined} aria-modal={fullscreenMap || undefined} aria-label={fullscreenMap ? t("Eastern Samar full map") : undefined} className={`workspace${panelOpen ? ' panel-open' : ''}`}>
        <aside className="report-panel" id="community-reports" aria-label={t("Community reports and filters")} tabIndex={0}>
          <div className="panel-heading"><div><span className="eyebrow">{t("YOUR COMMUNITY, IN VIEW")}</span><ReportHeading>{showSubmissions ? t("My reports") : t("Recent reports")} <span>{showSubmissions ? myReports.length : filtered.length}</span></ReportHeading></div><button className="icon-button mobile-close" onClick={() => setPanelOpen(false)} aria-label={t("Close report panel")}><X size={18} /></button></div>
          <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search reports, municipalities, barangays")} aria-label={t("Search reports or places")} />{query && <button onClick={() => setQuery('')} aria-label={t("Clear search")}><X size={14} /></button>}</div>
          <div className="report-feed-tabs" role="group" aria-label={t("Report views")}><button aria-pressed={!showSubmissions && !nearby} onClick={() => { setShowSubmissions(false); setNearby(null); setLocationError(''); }}>{t("Recent")}</button><button aria-pressed={Boolean(nearby) && !showSubmissions} disabled={locating} onClick={findNearby}>{locating ? t("Locating…") : t("Nearby")}</button><button aria-pressed={showSubmissions} onClick={() => navigate('submissions')}>{t("My Reports")}</button></div>
          {nearby && !showSubmissions && <p className="nearby-notice" role="status">{t("Within 10 km of your location, using approximate public report points. Other filters still apply. Your location is not saved.")}</p>}
          {locationError && <p className="nearby-notice" role="alert">{t(locationError)}</p>}
          {query.trim().length > 1 && (
            <div className="place-suggestions" aria-label={t("Places matching your search")}>
              {placeMatches.length ? placeMatches.map((option) => <button type="button" key={`${option.type}-${option.label}`} className="place-chip" onClick={() => focusOnPlace(option)}><MapPin size={11} /> <span>{option.label}</span> <b>{option.count}</b></button>) : <span className="place-chip-empty">{t("No place in the published reports matches “")}{query.trim()}{t("” yet.")}</span>}
            </div>
          )}
          <details className="report-filter-disclosure"><summary><Filter size={15} /><strong>{t("Filter reports")}</strong><span>{appliedFilterCount ? t("{{value1}} active", { value1: appliedFilterCount }) : t("Refine your view")}</span><ChevronDown size={14} /></summary><div className="filter-heading"><span>{t("Find what matters to you")}</span><button className="reset-button" onClick={clearFilters}>{t("Reset")}</button></div>
          <div className="filters-grid">
            <label className="filter-select"><MapPin size={14} /><select value={area} onChange={(event) => setArea(event.target.value)} aria-label={t("Filter by municipality")}><option value="all">{t("All municipalities")}</option>{MUNICIPALITIES.map((place) => <option key={place}>{place}</option>)}</select><ChevronDown size={13} /></label>
            <label className="filter-select"><Layers3 size={14} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t("Filter by category")}><option value="all">{t("All categories")}</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}</select><ChevronDown size={13} /></label>
            <label className="filter-select"><Activity size={14} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t("Filter by status")}><option value="all">{t("All statuses")}</option>{statusOptions.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select><ChevronDown size={13} /></label>
            <label className="filter-select"><CalendarDays size={14} /><select value={dateRange} onChange={(event) => setDateRange(event.target.value)} aria-label={t("Filter by date")}><option value="all">{t("Any time")}</option><option value="7">{t("Past 7 days")}</option><option value="30">{t("Past 30 days")}</option><option value="90">{t("Past 90 days")}</option></select><ChevronDown size={13} /></label>
          </div>
          </details>
          <div className="list-toolbar"><span role="status">{t(listCountLabel)}  {t("· newest first")}</span></div>
          <div className="report-list">{loading ? <div className="empty-state"><Search size={22} /><strong>{t("Loading reports…")}</strong></div> : showSubmissions ? (myReportsError ? <div className="empty-state" role="alert"><Inbox size={22} /><strong>{t("Submission history unavailable")}</strong><span>{t(myReportsError)}</span><button className="outline-button" disabled={myReportsRetrying} onClick={retryMyReports}>{myReportsRetrying ? t("Trying again…") : t("Try again")}</button></div> : filteredMyReports.length ? filteredMyReports.slice(0,listLimit).map((report) => <ReportRow key={report.id} report={report} theme={theme} decision={decisionText(report)} categoryName={categoryNames[report.category_slug] ?? report.category_slug} active={selected?.id === report.id} onSelect={openReport} />) : <div className="empty-state"><Inbox size={22} /><strong>{t("No submissions yet")}</strong><span>{t("Reports you send appear here with their review status.")}</span></div>) : filtered.length ? filtered.slice(0,listLimit).map((report) => <ReportRow key={report.id} report={report} theme={theme} categoryName={categoryNames[report.category_slug] ?? report.category_slug} active={selected?.id === report.id} onSelect={openReport} />) : <div className="empty-state"><Search size={22} /><strong>{t("No reports yet")}</strong><span>{t("Approved community reports will appear here.")}</span></div>}</div>
          {(showSubmissions ? filteredMyReports.length : filtered.length) > listLimit && <button className="outline-button" onClick={() => setListLimit(value => value+30)}>{t("Show more concerns")}</button>}{!showSubmissions && reports.length >= 500 && !olderExhausted && <button className="outline-button" disabled={olderBusy} onClick={loadOlderReports}>{olderBusy ? t("Loading older reports?") : t("Load older reports")}</button>}<div className="panel-footer"><span><Users size={15} />  {t("Built with community input")}</span><button className="footer-link" onClick={() => setNotice('Community reports are visible only after authorized review. Verification is not government endorsement.')}><ShieldCheck size={14} />  {t("Review standards")}</button></div>
        </aside>
        <div className="map-column"><div className="map-browse-bar"><div><span className="eyebrow">{t("EXPLORE YOUR PROVINCE")}</span><h2>{t("Eastern Samar")}</h2></div><div><button className="outline-button" onClick={() => setFullscreenMap(value => !value)}>{fullscreenMap ? t("Close full map") : t("Expand map")}</button><button className="outline-button map-list-alternative" onClick={() => navigate('reports')}>{t("Report list")}</button></div></div>
        {fullscreenMap && <label className="expanded-map-search"><Search size={18} /><input aria-label={t("Search the full map")} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search municipality, barangay or report")} />{query && <button className="icon-button" aria-label={t("Clear map search")} onClick={() => setQuery('')}><X size={18} /></button>}</label>}
        <ProvinceMap
          reports={filtered}
          theme={theme}
          onTheme={chooseThemeMode}
          categories={categories}
          counts={counts}
          category={category}
          onCategory={setCategory}
          filters={{ query, area, status, dateRange }} municipalities={MUNICIPALITIES} statuses={statusOptions}
          onFilters={(next) => { setQuery(next.query); setArea(next.area); setStatus(next.status); setDateRange(next.dateRange); }}
          area={area}
          selected={selected}
          onSelect={setSelected}
          focus={focus}
          picking={picking}
          onPick={pickPoint}
          onCancelPick={() => { setPicking(false); setFullscreenMap(false); setFormOpen(true); }}
          pickLocation={location}
          onStartReport={startReport}
          mappedCount={mappedCount}
          volunteerOpportunities={volunteerMapData.opportunities}
          volunteerSignupCounts={volunteerMapData.signupCounts}
          onVolunteerOpen={(opportunity, action) => {
            navigate('volunteers');
            setVolunteerInitial({ id: opportunity.id, action });
            setView('volunteers');
          }}
          detail={selected && !['reports', 'submissions'].includes(navigationTarget) ? <ReportDetailCard
            report={selected}
            canViewEvidence={isStaff || myReports.some((report) => report.id === selected.id)}
            categoryName={categoryNames[selected.category_slug] ?? selected.category_slug}
            markerColor={categoryVisual(selected.category_slug, theme).color}
            statusColorValue={statusColor(selected.status, theme)}
            decision={showSubmissions ? decisionText(selected) : undefined}
            onClose={() => setSelected(null)}
          /> : null}
        /></div>
      </section>
      <ReportTrends reports={categoryBase} />
      <ProvincePulse
        reports={categoryBase}
        theme={theme}
        categories={categories}
        coverage={municipalityCoverage(categoryBase)}
        counts={counts}
        isStaff={isStaff}
        pending={pending}
        verified={categoryBase.filter((report) => report.status === 'verified').length}
        resolved={categoryBase.filter((report) => report.status === 'resolved').length}
        thisWeek={withinDays(categoryBase, 7)}
        barangays={barangayCoverage(categoryBase)}
        municipalityTotal={MUNICIPALITIES.length}
        category={category}
        area={area}
        onSelectCategory={setCategory}
        onSelectPlace={focusOnPlace}
      />
    </>}
    </Suspense>
    {notice && <div className="toast" role="status"><span><Check size={15} /></span>{t(notice)}<button onClick={() => setNotice('')} aria-label={t("Dismiss message")}><X size={14} /></button></div>}
    {welcomeMessage && <div className="welcome-toast" role="status"><span><Check size={13} /></span><div><strong>{t(welcomeMessage)}</strong><small>{t("Ready to make a difference in Eastern Samar?")}</small></div></div>}
    {formOpen && authMode && isSupabaseConfigured && <AuthDialog supabase={supabase} initialMode={authMode} onNotice={setNotice} onAuthenticated={welcomeAfterLogin} onAccountCreated={(user, needsConfirmation) => { if (user?.id) setWelcomeTour({ userId: user.id, name: user.user_metadata?.display_name || '', needsConfirmation }); }} onClose={() => { setFormOpen(false); setAuthMode(null); }} />}
    {welcomeTour && <Suspense fallback={null}><SmartEsteWelcome name={welcomeTour.name} needsConfirmation={welcomeTour.needsConfirmation} exploring={Boolean(welcomeTour.exploring)} onExplore={exploreWelcomeFeature} onResume={resumeWelcomeTour} onFinish={closeWelcomeTour} /></Suspense>}
    {(formOpen || picking) && !authMode && <ReportDialog visitorMode={visitorReportingEnabled} userId={sessionUserId} categories={categories} onClose={() => { setFormOpen(false); setPicking(false); }} onSubmit={submitReport} onPickLocation={startPicking} location={location} hidden={picking} onDraftSaved={() => { setOfflineDraftCount(getOfflineDrafts().length); setNotice('Draft saved on this device for your account. Photos are not saved offline. Choose Sync Now when connected.'); }} />}
    <footer className="site-footer"><span><HeartPulse size={14} />  {t("Bridging Citizen Voices and Collective Action")}</span><button className="smart-tour-replay" type="button" onClick={() => setWelcomeTour({ userId: sessionUserId, name: profile?.display_name || '', needsConfirmation: false })}><Compass size={15} />  {t("SMART ESTE tour")}</button><span>{isSupabaseConfigured ? t("Shared reports · moderation required") : t("Database connection unavailable")}</span></footer>
    <nav className="mobile-bottom-nav" aria-label={t("Mobile community navigation")}>
      <button aria-current={activeNavigation === 'map' ? 'page' : undefined} onClick={() => navigate('map')}><Compass size={20} /><span>{t("Map")}</span></button>
      <button aria-current={activeNavigation === 'reports' ? 'page' : undefined} onClick={() => navigate('reports')}><Inbox size={20} /><span>{t("Reports")}</span></button>
      <button onClick={() => navigate('report')}><Plus size={21} /><span>{t("Submit")}</span></button>
      <button aria-current={activeNavigation === 'volunteers' ? 'page' : undefined} onClick={() => navigate('volunteers')}><Users size={20} /><span>{t('Volunteer', { context: 'navigation' })}</span></button>
      <button aria-current={activeNavigation === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}><ShieldCheck size={20} /><span>{t("Profile")}</span></button>
    </nav>
    {trackingOpen && <ReportTracking onClose={()=>setTrackingOpen(false)} />}
    {receipt && <ReportReceipt report={receipt} onClose={() => setReceipt(null)} onReports={() => { const visitor=Boolean(receipt.trackingCredential);setReceipt(null);if(visitor)setTrackingOpen(true);else navigate('submissions'); }} onAnother={() => { setReceipt(null); startReport(); }} />}
    {selected && ['reports', 'submissions'].includes(navigationTarget) && <ReportDetailsDialog report={selected} categoryName={categoryNames[selected.category_slug] ?? selected.category_slug} markerColor={categoryVisual(selected.category_slug, theme).color} statusColorValue={statusColor(selected.status, theme)} canViewEvidence={isStaff || myReports.some(report => report.id === selected.id)} decision={showSubmissions ? decisionText(selected) : undefined} onClose={() => setSelected(null)} />}
    <EmergencyHotlineDrawer
      isOpen={hotlinesOpen}
      onClose={() => setHotlinesOpen(false)}
      defaultMunicipality={area === 'all' ? 'all' : area}
    />
    {offlineDraftCount > 0 && (
      <aside className="offline-sync-toast" role="status" aria-label={t("Offline report drafts")}>
        <WifiOff size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
        <div className="offline-sync-copy">
          <strong>{offlineDraftCount}  {t("Offline")} {offlineDraftCount === 1 ? t("Report") : t("Reports")}  {t("Saved")}</strong>
          <span>{t("Stored on device. Ready to upload to SMART ESTE.")}</span>
        </div>
        <button
          type="button"
          className="sync-now-btn"
          onClick={handleSyncOfflineDrafts}
          disabled={syncingDrafts}
        >
          {syncingDrafts ? t("Uploading…") : t("Sync Now")}
        </button>
        <button type="button" className="outline-button" disabled={syncingDrafts} onClick={() => {try {getOfflineDrafts(sessionUserId || null).forEach(draft=>removeOfflineDraft(draft.id));setNotice('Your offline drafts were deleted from this device.');} catch(error) {setNotice(error.message);}}}>{t("Delete drafts")}</button>
      </aside>
    )}
  </main>;
}

export default App;

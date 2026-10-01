import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, FileText, Filter, MapPin,
  Search, ShieldCheck, Users, X,
} from 'lucide-react';
import { MUNICIPALITIES, categoryVisual, hasCoordinates } from '../lib/place.js';
import {
  cancelVolunteerRegistration, fetchVolunteerCommunityTotals, fetchVolunteerOpportunities,
  fetchVolunteerRegistrations, fetchVolunteerSignupCounts, registerForVolunteerOpportunity,
} from '../lib/volunteers.js';

const categories = [
  ['disaster-emergency', 'Disaster / Emergency'],
  ['infrastructure', 'Infrastructure'],
  ['environment', 'Environment'],
  ['public-safety', 'Public Safety'],
  ['health', 'Health & Services'],
  ['education', 'Education & Youth'],
  ['livelihood', 'Livelihood'],
];
const skillOptions = [
  'General Volunteer', 'Teaching', 'First Aid', 'Environmental Work',
  'Documentation', 'Photography', 'Event Support', 'Community Organizing',
];
const categorySlugs = {
  'disaster-emergency': ['disaster-emergency'],
  infrastructure: ['infrastructure'],
  environment: ['environment'],
  'public-safety': ['public-safety'],
  health: ['health', 'community-services'],
  education: ['education', 'youth'],
  livelihood: ['livelihood'],
};

function formatDate(value, options = { dateStyle: 'medium' }) {
  if (!value) return 'Schedule to be announced';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Schedule to be announced' : date.toLocaleString('en-PH', options);
}

function formatSchedule(opportunity) {
  if (!opportunity.starts_at) return 'Schedule to be announced';
  const starts = new Date(opportunity.starts_at);
  if (Number.isNaN(starts.getTime())) return 'Schedule to be announced';
  const date = starts.toLocaleDateString('en-PH', { dateStyle: 'medium' });
  const startTime = starts.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  if (!opportunity.ends_at) return `${date} · ${startTime}`;
  const ends = new Date(opportunity.ends_at);
  const endTime = Number.isNaN(ends.getTime()) ? '' : ends.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${startTime}${endTime ? `–${endTime}` : ''}`;
}

function opportunityPlace(opportunity) {
  return [opportunity.barangay, opportunity.municipality, 'Eastern Samar']
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(', ') || 'Eastern Samar';
}

function categoryName(value) {
  return categories.find(([slug]) => slug === value)?.[1]
    ?? (value ? value.replaceAll('-', ' ') : 'Community action');
}

function opportunityStatusLabel(opportunity, full) {
  if (full) return 'Full';
  if (opportunity.registration_open === false) return 'Registration closed';
  if (opportunity.status === 'cancelled') return 'Cancelled';
  if (opportunity.status === 'completed') return 'Completed';
  if (['active', 'ongoing'].includes(opportunity.status)) return 'In progress';
  return 'Open';
}

function registrationGroup(registration) {
  const { status } = registration;
  const activityStatus = registration.opportunity?.status;
  if (status === 'cancelled' || status === 'no_show' || activityStatus === 'cancelled') return 'cancelled';
  if (status === 'attended' || status === 'completed') return 'completed';
  if (activityStatus === 'completed') return 'needs-review';
  return 'upcoming';
}

function signupMessage(error) {
  if (error.code === '42501') return 'Sign in to join this activity.';
  if (error.code === '23505') return 'You already have a registration for this activity.';
  if (/capacity/i.test(error.message ?? '')) return 'This activity has reached its volunteer capacity.';
  if (/started|accepting volunteers|public/i.test(error.message ?? '')) return error.message;
  return 'Your registration could not be saved. Check your connection and try again.';
}

function SummaryMetric({ label, value, icon: Icon, loading }) {
  return <div className="volunteer-metric"><span className="volunteer-metric-icon"><Icon size={16} /></span><span><small>{label}</small><strong>{loading ? '—' : value}</strong></span></div>;
}

export default function VolunteerBoard({
  configured, userId, theme = 'light', reports = [], onSignIn, onMap, onOpenReport, onShowOnMap,
  initialOpportunityId, initialAction, onOpportunityOpened, onDataLoaded,
}) {
  const [opportunities, setOpportunities] = useState([]);
  const [signupCounts, setSignupCounts] = useState({});
  const [registrations, setRegistrations] = useState([]);
  const [communityTotals, setCommunityTotals] = useState({ volunteersJoined: 0, communityHours: 0 });
  const [loading, setLoading] = useState(configured);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationError, setRegistrationError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [view, setView] = useState('opportunities');
  const [selected, setSelected] = useState(null);
  const [dialog, setDialog] = useState('');
  const [success, setSuccess] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [municipality, setMunicipality] = useState('all');
  const [barangay, setBarangay] = useState('all');
  const [dateFilter, setDateFilter] = useState('upcoming');
  const [skill, setSkill] = useState('all');
  const [now] = useState(() => Date.now());
  const initialOpened = useRef(null);

  async function reloadOpportunities() {
    const nextOpportunities = await fetchVolunteerOpportunities();
    const nextCounts = await fetchVolunteerSignupCounts(nextOpportunities.map(({ id }) => id));
    setOpportunities(nextOpportunities);
    setSignupCounts(nextCounts);
    onDataLoaded?.(nextOpportunities, nextCounts);
  }

  async function reloadRegistrations() {
    if (!userId) {
      setRegistrations([]);
      return;
    }
    setRegistrationLoading(true);
    setRegistrationError('');
    try {
      setRegistrations(await fetchVolunteerRegistrations(userId));
    } catch {
      setRegistrationError('Your volunteer activities could not be loaded. Please try again.');
    } finally {
      setRegistrationLoading(false);
    }
  }

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    Promise.all([
      fetchVolunteerOpportunities(),
      fetchVolunteerRegistrations(userId),
      fetchVolunteerCommunityTotals(),
    ])
      .then(async ([nextOpportunities, nextRegistrations, totals]) => {
        const nextCounts = await fetchVolunteerSignupCounts(nextOpportunities.map(({ id }) => id));
        if (!active) return;
        setOpportunities(nextOpportunities);
        setSignupCounts(nextCounts);
        setRegistrations(nextRegistrations);
        setCommunityTotals(totals);
        onDataLoaded?.(nextOpportunities, nextCounts);
        setError('');
      })
      .catch(() => {
        if (active) setError('Volunteer opportunities could not be loaded. Apply the volunteer participation migration and try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [configured, onDataLoaded, userId]);

  useEffect(() => {
    if (userId && dialog === 'signin' && selected) setDialog('confirm');
  }, [dialog, selected, userId]);

  const openInitialOpportunity = useEffectEvent((match) => {
    setSelected(match);
    if (initialAction) beginJoin(match);
    else setDialog('details');
    setView('opportunities');
    initialOpened.current = initialOpportunityId;
    onOpportunityOpened?.();
  });

  useEffect(() => {
    if (!initialOpportunityId || !opportunities.length || initialOpened.current === initialOpportunityId) return;
    const match = opportunities.find((opportunity) => opportunity.id === initialOpportunityId);
    if (match) openInitialOpportunity(match);
  }, [initialOpportunityId, opportunities]);

  const joinedIds = useMemo(() => new Set(registrations
    .filter((registration) => registration.status !== 'cancelled')
    .map((registration) => registration.opportunity_id)), [registrations]);
  const barangayOptions = useMemo(() => [...new Set(opportunities
    .filter((opportunity) => municipality === 'all' || opportunity.municipality === municipality)
    .map(({ barangay: name }) => name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [municipality, opportunities]);
  const filteredOpportunities = useMemo(() => {
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + (endOfWeek.getDay() === 0 ? 0 : 7 - endOfWeek.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);
    const weekEnd = endOfWeek.getTime();
    const monthEnd = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1).getTime();
    const needle = query.trim().toLowerCase();
    return opportunities.filter((opportunity) => {
      const start = opportunity.starts_at ? Date.parse(opportunity.starts_at) : null;
      const searchText = `${opportunity.title} ${opportunity.description} ${opportunity.municipality ?? ''} ${opportunity.barangay ?? ''}`.toLowerCase();
      const skills = Array.isArray(opportunity.skills) ? opportunity.skills : [];
      return (!needle || searchText.includes(needle))
        && (category === 'all' || (categorySlugs[category] ?? [category]).includes(opportunity.category))
        && (municipality === 'all' || opportunity.municipality === municipality)
        && (barangay === 'all' || opportunity.barangay === barangay)
        && (skill === 'all' || skills.includes(skill))
        && (dateFilter === 'all'
          || (dateFilter === 'upcoming' && ['published', 'active', 'open', 'full'].includes(opportunity.status) && (start === null || start >= now))
          || (dateFilter === 'week' && ['published', 'active', 'open', 'full'].includes(opportunity.status) && start !== null && start >= now && start < weekEnd)
          || (dateFilter === 'month' && ['published', 'active', 'open', 'full'].includes(opportunity.status) && start !== null && start >= now && start < monthEnd));
    });
        }, [barangay, category, dateFilter, municipality, now, opportunities, query, skill]);

  const registrationsByGroup = useMemo(() => ({
    upcoming: registrations.filter((registration) => registrationGroup(registration) === 'upcoming'),
    completed: registrations.filter((registration) => registrationGroup(registration) === 'completed'),
    'needs-review': registrations.filter((registration) => registrationGroup(registration) === 'needs-review'),
    cancelled: registrations.filter((registration) => registrationGroup(registration) === 'cancelled'),
  }), [registrations]);
  const impact = useMemo(() => {
    const completed = registrations.filter((registration) => ['attended', 'completed'].includes(registration.status));
    const places = new Set(completed.map((registration) => {
      const activity = registration.opportunity;
      return activity?.municipality && activity?.barangay
        ? `${activity.municipality}::${activity.barangay}`
        : activity?.municipality || null;
    }).filter(Boolean));
    return {
      joined: registrations.filter((registration) => !['cancelled', 'no_show'].includes(registration.status)).length,
      completed: completed.length,
      communities: places.size,
    };
  }, [registrations]);
  const openCount = opportunities.filter((opportunity) => ['published', 'active', 'open'].includes(opportunity.status)
    && opportunity.registration_open !== false
    && (!opportunity.starts_at || Date.parse(opportunity.starts_at) > now)
    && (!opportunity.capacity || (signupCounts[opportunity.id] ?? 0) < opportunity.capacity)).length;
  const upcomingCount = opportunities.filter((opportunity) => ['published', 'active', 'open', 'full'].includes(opportunity.status)
    && (!opportunity.starts_at || Date.parse(opportunity.starts_at) >= now)).length;

  function clearFilters() {
    setQuery(''); setCategory('all'); setMunicipality('all'); setBarangay('all'); setDateFilter('upcoming'); setSkill('all');
  }

  function openDetails(opportunity) {
    setSelected(opportunity);
    setMessage('');
    setDialog('details');
  }

  function beginJoin(opportunity) {
    setSelected(opportunity);
    setMessage('');
    if (!userId) setDialog('signin');
    else if (joinedIds.has(opportunity.id)) setMessage('You already joined this activity. Find it under My Activities.');
    else if (opportunity.status === 'cancelled') setMessage('This activity was cancelled and is no longer accepting volunteers.');
    else if (opportunity.status === 'full' || (opportunity.capacity && (signupCounts[opportunity.id] ?? 0) >= opportunity.capacity)) setMessage('This activity has reached its volunteer capacity.');
    else if (opportunity.registration_open === false) setMessage('The organizer has closed registration for this activity.');
    else if (!['published', 'active', 'open'].includes(opportunity.status)) setMessage('This activity is not accepting volunteers right now.');
    else if (opportunity.starts_at && Date.parse(opportunity.starts_at) <= Date.now()) setMessage('Registration is closed because this activity has started.');
    else setDialog('confirm');
  }

  async function confirmJoin() {
    if (!selected || !userId) return;
    setBusyId(selected.id);
    setMessage('');
    try {
      await registerForVolunteerOpportunity(selected.id);
      const confirmed = selected;
      setSuccess(confirmed);
      setDialog('success');
      try {
        const [, , totals] = await Promise.all([reloadOpportunities(), reloadRegistrations(), fetchVolunteerCommunityTotals()]);
        setCommunityTotals(totals);
      } catch {
        setMessage('Your registration is saved. Some summary counts could not be refreshed.');
      }
    } catch (joinError) {
      setMessage(signupMessage(joinError));
      if (joinError.code === '23505') await reloadRegistrations();
      if (/capacity/i.test(joinError.message ?? '')) await reloadOpportunities();
    } finally {
      setBusyId(null);
    }
  }

  async function cancelRegistration(registration) {
    setBusyId(registration.id);
    setMessage('');
    try {
      await cancelVolunteerRegistration(registration.id);
      setMessage('Your registration has been cancelled.');
      try {
        const [, totals] = await Promise.all([reloadOpportunities(), fetchVolunteerCommunityTotals()]);
        setCommunityTotals(totals);
        await reloadRegistrations();
      } catch {
        setMessage('Your registration is cancelled. Some summary details could not be refreshed.');
      }
    } catch {
      setMessage('Your registration could not be cancelled. It may already be underway or completed.');
    } finally {
      setBusyId(null);
    }
  }

  function renderOpportunityCard(opportunity) {
    const count = signupCounts[opportunity.id] ?? 0;
    const categoryColor = categoryVisual(opportunity.category, theme).color;
    const full = Boolean(opportunity.capacity && count >= opportunity.capacity) || opportunity.status === 'full';
    const joined = joinedIds.has(opportunity.id);
    const relatedReport = reports.find((report) => report.id === opportunity.report_id);
    return <article className="volunteer-opportunity" key={opportunity.id}>
      <div className="volunteer-opportunity-copy">
        <div className="volunteer-card-kicker"><span className={`volunteer-status${full ? ' is-full' : ''}`}>{opportunityStatusLabel(opportunity, full)}</span><span className="volunteer-category" style={{ '--volunteer-category-color': categoryColor }}>{categoryName(opportunity.category)}</span></div>
        <h2>{opportunity.title}</h2>
        <p>{opportunity.description}</p>
        <div className="volunteer-meta">
          <span><MapPin size={13} />{opportunityPlace(opportunity)}</span>
          <span><CalendarDays size={13} />{formatSchedule(opportunity)}</span>
          <span><Users size={13} />{opportunity.capacity ? `${count} joined · ${Math.max(0, opportunity.capacity - count)} ${Math.max(0, opportunity.capacity - count) === 1 ? 'volunteer' : 'volunteers'} needed` : `${count} joined · no set limit`}</span>
        </div>
        <div className="volunteer-card-footer">
          <span><ShieldCheck size={13} />{opportunity.organizer_name || 'Community organizer'}</span>
          {relatedReport && <button type="button" className="volunteer-report-link" onClick={() => onOpenReport(relatedReport)}><FileText size={13} />Related community report</button>}
        </div>
      </div>
      <div className="volunteer-card-actions">
        <button type="button" className="outline-button volunteer-action" onClick={() => openDetails(opportunity)}>View details</button>
        <button type="button" className="primary-button volunteer-action" disabled={full || joined || opportunity.registration_open === false || ['cancelled', 'completed', 'ongoing'].includes(opportunity.status)} onClick={() => beginJoin(opportunity)}>
          {joined ? 'Already joined' : opportunity.status === 'cancelled' ? 'Cancelled' : opportunity.status === 'completed' ? 'Activity ended' : full ? 'At capacity' : opportunity.registration_open === false ? 'Registration closed' : 'Join'}
        </button>
      </div>
    </article>;
  }

  function renderRegistration(registration) {
    const opportunity = registration.opportunity;
    const canCancel = registration.status === 'registered'
      && ['published', 'active', 'open'].includes(opportunity?.status)
      && (!opportunity?.starts_at || Date.parse(opportunity.starts_at) > now);
    const statusText = registration.status === 'no_show' ? 'No show'
      : registration.status === 'attended' ? 'Attended'
        : registration.status === 'completed' ? 'Completed'
          : opportunity?.status === 'completed' ? 'Awaiting attendance'
          : registration.status === 'cancelled' || opportunity?.status === 'cancelled' ? 'Cancelled' : 'Registered';
    return <article className="volunteer-my-card" key={registration.id}>
      <div className="volunteer-my-main"><span className={`volunteer-my-status is-${statusText.toLowerCase().replaceAll(' ', '-')}`}>{statusText}</span><h3>{opportunity?.title ?? 'Volunteer activity'}</h3>
        <div className="volunteer-meta"><span><MapPin size={13} />{opportunityPlace(opportunity ?? {})}</span><span><CalendarDays size={13} />{formatSchedule(opportunity ?? {})}</span><span><Clock3 size={13} />{registration.volunteer_hours === null ? 'Hours not recorded' : `${Number(registration.volunteer_hours)} hours recorded`}</span></div>
        <small><ShieldCheck size={12} />{opportunity?.organizer_name || 'Community organizer'}</small>
      </div>
      {canCancel
        && <button type="button" className="outline-button volunteer-cancel-button" disabled={busyId === registration.id} onClick={() => cancelRegistration(registration)}>{busyId === registration.id ? 'Cancelling…' : 'Cancel registration'}</button>}
    </article>;
  }

  return <section className="volunteer-page" aria-labelledby="volunteer-title">
    <header className="volunteer-heading">
      <div><span className="eyebrow">EASTERN SAMAR · COMMUNITY ACTION</span></div>
      <button type="button" className="outline-button volunteer-map-button" onClick={onMap}><ArrowLeft size={14} /> Back to map</button>
    </header>

    <div className="volunteer-dashboard-top">
      <div className="volunteer-welcome"><span className="eyebrow">EASTERN SAMAR, EASTERN VISAYAS</span><h2>Small acts. Stronger communities.</h2><p>From Borongan City to the coastal and inland barangays, find a local way to lend a hand.</p><button type="button" className="primary-button" onClick={() => { setView('opportunities'); document.getElementById('volunteer-opportunities')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><Search size={15} />Find Volunteer Opportunities</button></div>
      <div className="volunteer-metrics" aria-label="Volunteer activity summary">
        <SummaryMetric label="Available opportunities" value={openCount} icon={Users} loading={loading} />
        <SummaryMetric label="Upcoming activities" value={upcomingCount} icon={CalendarDays} loading={loading} />
        <SummaryMetric label="Volunteers joined" value={communityTotals.volunteersJoined} icon={ShieldCheck} loading={loading} />
        <SummaryMetric label="Community hours" value={communityTotals.communityHours} icon={Clock3} loading={loading} />
      </div>
    </div>

    {configured && !userId && <div className="volunteer-signin-note"><ShieldCheck size={16} /><span>You need an account to join an activity. Your registration stays linked to your account.</span><button type="button" className="text-button" onClick={() => onSignIn('sign-in')}>Log in</button><button type="button" className="text-button" onClick={() => onSignIn('sign-up')}>Create account</button></div>}
    {!configured && <div className="volunteer-empty"><Users size={24} /><strong>Volunteer listings are unavailable in demo mode.</strong><span>Connect the shared Supabase database to view local opportunities and record participation.</span></div>}
    {configured && error && <div className="volunteer-error" role="alert"><strong>Volunteer listings are unavailable.</strong><span>{error}</span><button type="button" className="outline-button" onClick={() => { setLoading(true); setError(''); Promise.all([reloadOpportunities(), reloadRegistrations()]).catch(() => setError('Volunteer data is still unavailable. Check the migration and database connection.')).finally(() => setLoading(false)); }}>Try again</button></div>}

    <div className="volunteer-tabs" role="tablist" aria-label="Volunteer views">
      <button type="button" role="tab" aria-selected={view === 'opportunities'} className={view === 'opportunities' ? 'is-active' : ''} onClick={() => setView('opportunities')}>Opportunities <span>{opportunities.length}</span></button>
      <button type="button" role="tab" aria-selected={view === 'my-activities'} className={view === 'my-activities' ? 'is-active' : ''} onClick={() => { setView('my-activities'); reloadRegistrations(); }}>My Activities <span>{userId ? registrations.length : '—'}</span></button>
    </div>

    {view === 'opportunities' && <section className="volunteer-browse" id="volunteer-opportunities" aria-label="Browse volunteer opportunities">
      <div className="volunteer-section-heading"><div><span className="eyebrow">LOCAL CALLS TO ACTION</span><h2>Find your next activity</h2></div><span>{filteredOpportunities.length} {filteredOpportunities.length === 1 ? 'opportunity' : 'opportunities'}</span></div>
      <div className="volunteer-filters">
        <label className="volunteer-search"><Search size={15} /><input aria-label="Search opportunities" placeholder="Search activity, barangay, municipality" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="volunteer-filter"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}</select></label>
        <label className="volunteer-filter"><span>Municipality</span><select value={municipality} onChange={(event) => { setMunicipality(event.target.value); setBarangay('all'); }}><option value="all">All municipalities</option>{MUNICIPALITIES.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="volunteer-filter"><span>Barangay</span><select value={barangay} onChange={(event) => setBarangay(event.target.value)}><option value="all">All barangays</option>{barangayOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="volunteer-filter"><span>Date</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="upcoming">Upcoming</option><option value="week">This week</option><option value="month">This month</option><option value="all">Any date</option></select></label>
        <label className="volunteer-filter"><span>Useful skill</span><select value={skill} onChange={(event) => setSkill(event.target.value)}><option value="all">Any skill</option>{skillOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button type="button" className="volunteer-reset" onClick={clearFilters}><Filter size={13} />Reset</button>
      </div>
      {loading ? <div className="volunteer-skeletons" role="status" aria-label="Loading opportunities"><i /><i /><i /></div>
        : !error && filteredOpportunities.length ? <div className="volunteer-list">{filteredOpportunities.map(renderOpportunityCard)}</div>
          : !error && <div className="volunteer-empty"><Search size={23} /><strong>{opportunities.length ? 'No activities match those filters.' : 'No public volunteer opportunities yet.'}</strong><span>{opportunities.length ? 'Try a wider location or date, or clear some filters.' : 'When an organizer publishes an activity in Eastern Samar, it will appear here.'}</span>{opportunities.length > 0 && <button type="button" className="outline-button" onClick={clearFilters}>Clear filters</button>}</div>}
    </section>}

    {view === 'my-activities' && <section className="volunteer-my-activities" aria-labelledby="my-activities-title">
      {!userId ? <div className="volunteer-empty"><ShieldCheck size={24} /><strong>Log in to see your activities.</strong><span>Your joined activities and community impact are private to your account.</span><button type="button" className="primary-button" onClick={() => onSignIn('sign-in')}>Log in</button></div>
        : <>
          <div className="volunteer-section-heading"><div><span className="eyebrow">YOUR COMMUNITY PARTICIPATION</span><h2 id="my-activities-title">My Activities</h2></div></div>
          <section className="volunteer-impact" aria-labelledby="impact-title"><div className="volunteer-impact-head"><div><span className="eyebrow">YOUR CONTRIBUTION</span><h3 id="impact-title">My Community Impact</h3></div><span>Recorded participation only</span></div><div className="volunteer-impact-grid"><SummaryMetric label="Activities joined" value={impact.joined} icon={Users} loading={registrationLoading} /><SummaryMetric label="Activities completed" value={impact.completed} icon={Check} loading={registrationLoading} /><SummaryMetric label="Volunteer hours" value={registrations.filter((registration) => ['attended', 'completed'].includes(registration.status)).reduce((sum, registration) => sum + Number(registration.volunteer_hours ?? 0), 0)} icon={Clock3} loading={registrationLoading} /><SummaryMetric label="Communities reached" value={impact.communities} icon={MapPin} loading={registrationLoading} /></div></section>
          <div className="volunteer-my-groups">
            {['upcoming', 'needs-review', 'completed', 'cancelled'].map((group) => <section className="volunteer-my-group" key={group} aria-labelledby={`group-${group}`}><header><h3 id={`group-${group}`}>{group === 'needs-review' ? 'Attendance to confirm' : `${group[0].toUpperCase()}${group.slice(1)}`}</h3><span>{registrationsByGroup[group].length}</span></header>
              {registrationLoading ? <div className="volunteer-my-loading" />
                : registrationsByGroup[group].length ? registrationsByGroup[group].map(renderRegistration)
                  : group === 'upcoming' && !registrations.length ? <div className="volunteer-empty volunteer-my-empty"><strong>You haven't joined an activity yet.</strong><span>Explore local opportunities and find a way to help your community.</span><button type="button" className="primary-button" onClick={() => { setView('opportunities'); document.getElementById('volunteer-opportunities')?.scrollIntoView({ behavior: 'smooth' }); }}>Find Opportunities <ArrowRight size={14} /></button></div>
                    : <p className="volunteer-group-empty">No {group} activities to show.</p>}
            </section>)}
          </div>
          {registrationError && <p className="volunteer-message is-error" role="alert">{registrationError}</p>}
        </>}
    </section>}

    {message && !dialog && <p className="volunteer-message" role="status">{message}</p>}
    {configured && <p className="volunteer-privacy"><ShieldCheck size={13} /> Published Eastern Samar activities only · registrations are private to you and authorized staff</p>}

    {dialog && selected && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDialog('')}>
      <section className="report-modal volunteer-modal" role="dialog" aria-modal="true" aria-labelledby="volunteer-detail-title">
        <div className="modal-head"><div><span className="eyebrow">EASTERN SAMAR · VOLUNTEER ACTIVITY</span><h2 id="volunteer-detail-title">{dialog === 'success' ? "You're in!" : dialog === 'confirm' ? 'Join this activity?' : selected.title}</h2></div><button type="button" className="icon-button" onClick={() => setDialog('')} aria-label="Close activity details"><X size={19} /></button></div>
        {dialog === 'details' && <div className="volunteer-detail-content">
          <div className="volunteer-detail-banner"><span className="volunteer-category" style={{ '--volunteer-category-color': categoryVisual(selected.category, theme).color }}>{categoryName(selected.category)}</span><h3>{selected.title}</h3><span className="volunteer-status">{selected.status === 'full' ? 'At capacity' : selected.status === 'cancelled' ? 'Cancelled' : selected.status === 'completed' ? 'Completed' : selected.registration_open === false ? 'Registration closed' : 'Accepting volunteers'}</span></div>
          <section><h4>About this activity</h4><p>{selected.description}</p></section>
          <section><h4>Location</h4><p><MapPin size={14} />{opportunityPlace(selected)}{selected.location ? ` · ${selected.location}` : ''}</p>{hasCoordinates(selected) && <button type="button" className="text-button" onClick={() => { setDialog(''); onShowOnMap(selected); }}>Show on the Eastern Samar map</button>}</section>
          <div className="volunteer-detail-grid"><section><h4>Schedule</h4><p><CalendarDays size={14} />{formatSchedule(selected)}</p></section><section><h4>Organizer</h4><p><ShieldCheck size={14} />{selected.organizer_name || 'Organizer details are not available'}</p></section></div>
          <section><h4>Volunteer capacity</h4><p>{selected.capacity ? `${signupCounts[selected.id] ?? 0} / ${selected.capacity} volunteers joined` : `${signupCounts[selected.id] ?? 0} volunteers joined · no set limit`}</p>{selected.capacity && <div className="volunteer-progress" role="progressbar" aria-label="Volunteer capacity" aria-valuemin="0" aria-valuemax={selected.capacity} aria-valuenow={Math.min(signupCounts[selected.id] ?? 0, selected.capacity)}><i style={{ width: `${Math.min(100, (signupCounts[selected.id] ?? 0) / selected.capacity * 100)}%` }} /></div>}</section>
          {Array.isArray(selected.tasks) && selected.tasks.length > 0 && <section><h4>What volunteers will do</h4><ul>{selected.tasks.map((task, index) => <li key={`${task}-${index}`}>{task}</li>)}</ul></section>}
          {Array.isArray(selected.what_to_bring) && selected.what_to_bring.length > 0 && <section><h4>What to bring</h4><ul>{selected.what_to_bring.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
          {Array.isArray(selected.skills) && selected.skills.length > 0 && <section><h4>Useful skills</h4><div className="volunteer-skill-list">{selected.skills.map((item) => <span key={item}>{item}</span>)}</div></section>}
          {message && <p className="volunteer-message" role="status">{message}</p>}
          <div className="volunteer-modal-actions"><button type="button" className="outline-button" onClick={() => setDialog('')}>Close</button><button type="button" className="primary-button" disabled={selected.registration_open === false || ['full', 'cancelled', 'completed', 'ongoing'].includes(selected.status)} onClick={() => beginJoin(selected)}>Join Activity</button></div>
        </div>}
        {dialog === 'confirm' && <div className="volunteer-confirm-content"><p>Activity: <strong>{selected.title}</strong></p><p>Date: <strong>{formatSchedule(selected)}</strong></p><p>Location: <strong>{opportunityPlace(selected)}</strong></p><label><input type="checkbox" onChange={(event) => setMessage(event.target.checked ? 'consent' : '')} /> By joining, I understand that I am volunteering for this community activity.</label>{message && message !== 'consent' && <p className="volunteer-message is-error" role="alert">{message}</p>}<div className="volunteer-modal-actions"><button type="button" className="outline-button" onClick={() => { setDialog('details'); setMessage(''); }}>Cancel</button><button type="button" className="primary-button" disabled={busyId === selected.id || message !== 'consent'} onClick={confirmJoin}>{busyId === selected.id ? 'Joining…' : 'Confirm & Join'}</button></div></div>}
        {dialog === 'signin' && <div className="volunteer-confirm-content"><p>You need an account to join this activity.</p><div className="volunteer-confirm-summary"><strong>{selected.title}</strong><span>{formatSchedule(selected)}</span><span>{opportunityPlace(selected)}</span></div><div className="volunteer-modal-actions"><button type="button" className="outline-button" onClick={() => setDialog('details')}>Back to details</button><button type="button" className="outline-button" onClick={() => onSignIn('sign-up')}>Create account</button><button type="button" className="primary-button" onClick={() => onSignIn('sign-in')}>Log in</button></div></div>}
        {dialog === 'success' && <div className="volunteer-success-content"><span className="volunteer-success-mark"><Check size={24} /></span><p>You have successfully joined this volunteer activity.</p>{message && <p className="volunteer-message" role="status">{message}</p>}<dl><div><dt>Activity</dt><dd>{success?.title}</dd></div><div><dt>Date</dt><dd>{success ? formatDate(success.starts_at) : ''}</dd></div><div><dt>Time</dt><dd>{success ? formatSchedule(success).split(' · ')[1] || 'To be announced' : ''}</dd></div><div><dt>Location</dt><dd>{opportunityPlace(success ?? {})}</dd></div><div><dt>Organizer</dt><dd>{success?.organizer_name || 'Community organizer'}</dd></div></dl><div className="volunteer-modal-actions"><button type="button" className="outline-button" onClick={() => { setDialog(''); setView('opportunities'); }}>Back to Opportunities</button><button type="button" className="primary-button" onClick={() => { setDialog(''); setView('my-activities'); reloadRegistrations(); }}>View My Volunteer Activities</button></div></div>}
      </section>
    </div>}
  </section>;
}
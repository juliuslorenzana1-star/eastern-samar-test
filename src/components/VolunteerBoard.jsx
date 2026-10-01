import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, ShieldCheck, Users } from 'lucide-react';
import {
  fetchVolunteerOpportunities, fetchVolunteerSignupIds, setVolunteerSignup,
} from '../lib/volunteers.js';

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined,
  });
}

export default function VolunteerBoard({ configured, userId, onSignIn, onMap }) {
  const [opportunities, setOpportunities] = useState([]);
  const [signupIds, setSignupIds] = useState([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!configured) return undefined;
    let active = true;
    Promise.all([
      fetchVolunteerOpportunities(),
      userId ? fetchVolunteerSignupIds(userId) : Promise.resolve([]),
    ])
      .then(([nextOpportunities, nextSignupIds]) => {
        if (!active) return;
        setOpportunities(nextOpportunities);
        setSignupIds(nextSignupIds);
        setError('');
      })
      .catch(() => {
        if (active) setError('Volunteer opportunities could not be loaded. Please try again later.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [configured, userId]);

  async function toggleSignup(opportunity) {
    if (!userId) {
      onSignIn();
      return;
    }
    const isJoined = signupIds.includes(opportunity.id);
    setBusyId(opportunity.id);
    setMessage('');
    try {
      await setVolunteerSignup(opportunity.id, userId, !isJoined);
      setSignupIds((current) => isJoined
        ? current.filter((id) => id !== opportunity.id)
        : [...current, opportunity.id]);
      setMessage(isJoined ? 'You left this volunteer opportunity.' : 'You are signed up to participate.');
    } catch (signupError) {
      setMessage(signupError.code === '23505'
        ? 'Your account is already signed up for this opportunity.'
        : 'Your signup could not be updated. Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="volunteer-page" aria-labelledby="volunteer-title">
      <header className="volunteer-heading">
        <div>
          <span className="eyebrow">EASTERN SAMAR · COMMUNITY ACTION</span>
          <h1 id="volunteer-title">Volunteer in your community</h1>
          <p>Find published opportunities to support community action across Eastern Samar.</p>
        </div>
        <button type="button" className="outline-button volunteer-map-button" onClick={onMap}>
          <ArrowLeft size={14} /> Back to map
        </button>
      </header>

      {!userId && configured && (
        <div className="volunteer-signin-note"><ShieldCheck size={16} />
          <span>Sign in to participate. Your signup is tied to your account.</span>
          <button type="button" className="text-button" onClick={onSignIn}>Sign in</button>
        </div>
      )}

      {!configured ? (
        <div className="volunteer-empty"><Users size={24} /><strong>Volunteer listings are unavailable in demo mode.</strong><span>Connect the shared database to view published opportunities.</span></div>
      ) : loading ? (
        <div className="volunteer-empty" role="status"><Users size={24} /><strong>Loading volunteer opportunities…</strong></div>
      ) : error ? (
        <div className="volunteer-empty" role="alert"><Users size={24} /><strong>Volunteer listings are unavailable.</strong><span>{error}</span></div>
      ) : opportunities.length ? (
        <div className="volunteer-list">
          {opportunities.map((opportunity) => {
            const joined = signupIds.includes(opportunity.id);
            const starts = formatDate(opportunity.starts_at);
            const ends = formatDate(opportunity.ends_at);
            return (
              <article className="volunteer-opportunity" key={opportunity.id}>
                <div className="volunteer-opportunity-copy">
                  <span className="volunteer-status">{opportunity.status === 'active' ? 'Active' : 'Published'}</span>
                  <h2>{opportunity.title}</h2>
                  <p>{opportunity.description}</p>
                  <div className="volunteer-meta">
                    {opportunity.municipality && <span><MapPin size={13} />{opportunity.municipality}</span>}
                    {starts && <span><CalendarDays size={13} />{starts}{ends && ` · until ${ends}`}</span>}
                    {opportunity.capacity && <span><Users size={13} />Limit {opportunity.capacity}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className={joined ? 'outline-button volunteer-action is-joined' : 'primary-button volunteer-action'}
                  disabled={busyId === opportunity.id}
                  onClick={() => toggleSignup(opportunity)}
                >
                  {busyId === opportunity.id ? 'Saving…' : joined ? 'Leave opportunity' : userId ? 'Sign up' : 'Sign in to participate'}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="volunteer-empty"><Users size={24} /><strong>No public volunteer opportunities yet.</strong><span>When an organizer publishes an opportunity, it will appear here.</span></div>
      )}
      {message && <p className="volunteer-message" role="status">{message}</p>}
      {configured && <p className="volunteer-privacy"><ShieldCheck size={13} /> Published listings only · signups are private to you and authorized staff</p>}
    </section>
  );
}
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { updateProfileLeaderboardVisibility } from '../lib/volunteers.js';

const BADGES = {
  'first-community-action': ['First Community Action', 'Complete one verified activity.'],
  'active-volunteer': ['Active Volunteer', 'Complete three verified activities.'],
  'environmental-champion': ['Environmental Champion', 'Complete three environmental activities.'],
  'community-builder': ['Community Builder', 'Complete five activities across at least two municipalities.'],
  'dedicated-volunteer': ['Dedicated Volunteer', 'Complete five activities and earn 40 verified hours.'],
};
async function readRecognition(name) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { data, error } = await supabase.rpc(name);
  if (error) throw error;
  return data;
}
function Badges({ earned = [] }) {
  return earned.length ? <ul className="recognition-badges">{earned.filter(id => BADGES[id]).map(id => <li key={id}><strong>{BADGES[id][0]}</strong><small>{BADGES[id][1]}</small></li>)}</ul> : <p>No milestones earned yet. Your first completed activity starts your journey.</p>;
}
function PersonalRecognition({ onUpdated }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [alias, setAlias] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    readRecognition('get_my_recognition').then(next => {
      if (active) { if (!next) throw new Error('Your recognition profile could not be loaded.'); setData(next); setAlias(next.public_alias || ''); setVisible(Boolean(next.show_on_leaderboard)); setError(''); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [retry]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await updateProfileLeaderboardVisibility(visible, alias);
      const next = await readRecognition('get_my_recognition');
      setData(next); onUpdated(); setMessage('Your recognition privacy settings were saved.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="recognition-personal" aria-labelledby="my-recognition-title"><h2 id="my-recognition-title">My contribution</h2>
    {error && <div role="alert"><p>{error}</p><button className="outline-button" onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
    {!data && !error && <p role="status">Loading your verified contribution…</p>}
    {data && <><div className="recognition-metrics"><p><strong>{Number(data.verified_hours)}</strong> verified hours</p><p><strong>{Number(data.completed_activities)}</strong> completed activities</p><p><strong>{data.rank ? `#${data.rank}` : 'Private / unranked'}</strong> public position</p></div>
      <h3>Earned milestones</h3><Badges earned={data.badges} />
      <form onSubmit={save} className="recognition-privacy"><h3>Public recognition is your choice</h3><p>Your contribution stays private until you opt in with a public alias. You can hide your entry at any time without losing your records.</p>
        <label>Public alias<input value={alias} maxLength={80} onChange={e => setAlias(e.target.value)} disabled={busy} autoComplete="off" /></label>
        <label className="recognition-checkbox"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} disabled={busy} />Show my alias and verified contribution on the public leaderboard</label>
        <button className="primary-button" disabled={busy || (visible && !alias.trim())}>{busy ? 'Saving…' : 'Save privacy settings'}</button><p role="status">{message}</p>
      </form>
      <h3>Verified contribution history</h3><p>Latest 100 verified records. Totals include all verified service.</p>
      {data.history?.length ? <ul className="recognition-history">{data.history.map(item => <li key={item.id}><strong>{item.title}</strong><span>{item.municipality || 'Eastern Samar'} · {item.status} · {Number(item.hours)} hours</span><small>{item.completed_at ? new Date(item.completed_at).toLocaleDateString('en-PH') : 'Date not recorded'}</small></li>)}</ul> : <p>No verified service yet. Staff-confirmed attendance and completed actions will appear here.</p>}
    </>}
  </section>;
}
export default function CommunityRecognition({ userId, onBack, onSignIn }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    readRecognition('get_community_recognition').then(data => { if (active) { setEntries(data || []); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [retry]);
  return <div className="community-recognition"><button className="outline-button" onClick={onBack}>Back to volunteer opportunities</button>
    <section className="recognition-public" aria-labelledby="public-recognition-title"><h2 id="public-recognition-title">Estehanon Community Leaders</h2><p>Celebrating the time our neighbors give to Eastern Samar. Only staff-verified service counts. Public participation is optional.</p>
      <p>Top 100 public contributors, ranked by verified hours. Equal hours share the same rank. Completed activities count separately.</p>
      {error ? <div role="alert"><p>We could not load community recognition. {error}</p><button className="outline-button" onClick={() => setRetry(n => n + 1)}>Try again</button></div> : entries === null ? <p role="status">Loading community recognition…</p> : entries.length ? <ol className="recognition-ranking">{entries.map((entry,index) => <li key={`${entry.public_alias}-${index}`}><span className="recognition-rank">#{entry.rank}</span><div><h3>{entry.public_alias}</h3><p>{Number(entry.verified_hours)} verified hours · {Number(entry.completed_activities)} completed activities</p><Badges earned={entry.badges} /></div></li>)}</ol> : <div className="recognition-empty"><h3>Every contribution starts somewhere.</h3><p>No public contributors yet. As volunteers earn verified hours and choose to share them, their service will be celebrated here.</p></div>}
    </section>
    {userId ? <PersonalRecognition key={userId} onUpdated={() => setRetry(n => n + 1)} /> : <section className="recognition-personal"><h2>Your community journey</h2><p>Sign in to see your private service history, earned milestones and recognition settings.</p><button className="primary-button" onClick={onSignIn}>Sign in to view my contribution</button></section>}
    <details className="recognition-criteria"><summary>How recognition milestones are earned</summary><ul>{Object.entries(BADGES).map(([id,[name,criteria]]) => <li key={id}><strong>{name}</strong> — {criteria}</li>)}</ul><p>Milestones are calculated from verified records. Registered, cancelled and no-show activities do not count.</p></details>
  </div>;
}

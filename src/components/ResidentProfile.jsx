import { ArrowRight, CircleHelp, Inbox, LogOut, PhoneCall, ShieldCheck, Users } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';

export default function ResidentProfile({ user, profile, isStaff, themeMode, onTheme, onNavigate, onSignIn, onSignOut, onHotlines }) {
  return <section className="resident-profile" aria-labelledby="profile-title">
    <header><span className="profile-avatar"><ShieldCheck size={30} /></span><div><span className="eyebrow">YOUR SMART ESTE</span><h1 id="profile-title">{user ? profile?.display_name || 'My account' : 'Welcome, neighbor.'}</h1><p>{user ? 'Your reports, your service, your community.' : 'Sign in to report a concern and take part in local activities.'}</p></div></header>
    {!user && <button className="primary-button" onClick={onSignIn}>Sign in or create an account<ArrowRight size={18} /></button>}
    {user && <div className="profile-links"><button onClick={() => onNavigate('submissions')}><Inbox />My Reports<ArrowRight /></button><button onClick={() => onNavigate('activities')}><Users />My Volunteer Activities<ArrowRight /></button></div>}
    <div className="profile-preference"><span>Appearance</span><ThemeToggle mode={themeMode} onChange={onTheme} /></div>
    <div className="profile-links"><button onClick={() => onNavigate('about')}><CircleHelp />Help &amp; reporting guidelines<ArrowRight /></button><button onClick={onHotlines}><PhoneCall />Emergency contacts<ArrowRight /></button></div>
    {isStaff && <div className="profile-links"><button onClick={() => onNavigate('review')}><ShieldCheck />Staff moderation<ArrowRight /></button><a href={`${import.meta.env.BASE_URL}operations/`}><ShieldCheck />Operations command<ArrowRight /></a></div>}
    {user && <button className="outline-button profile-logout" onClick={onSignOut}><LogOut size={18} />Log out</button>}
    <p className="profile-privacy">Your submissions and private evidence are available only to you and authorized staff.</p>
  </section>;
}

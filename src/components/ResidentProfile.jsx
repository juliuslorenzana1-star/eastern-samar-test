import { t } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CircleHelp, Inbox, LogOut, PhoneCall, ShieldCheck, Users } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import LanguageSelector from './LanguageSelector.jsx';

export default function ResidentProfile({ user, profile, isStaff, themeMode, onTheme, onNavigate, onSignIn, onSignOut, onHotlines }) {
  useTranslation();
  return <section className="resident-profile" aria-labelledby="profile-title">
    <header><span className="profile-avatar"><ShieldCheck size={30} /></span><div><span className="eyebrow">{t("YOUR SMART ESTE")}</span><h1 id="profile-title">{user ? profile?.display_name || t("My account") : t("Welcome, neighbor.")}</h1><p>{user ? t("Your reports, your service, your community.") : t("Sign in to report a concern and take part in local activities.")}</p></div></header>
    {!user && <button className="primary-button" onClick={onSignIn}>{t("Sign in or create an account")}<ArrowRight size={18} /></button>}
    {user && <div className="profile-links"><button onClick={() => onNavigate('submissions')}><Inbox />{t("My Reports")}<ArrowRight /></button><button onClick={() => onNavigate('activities')}><Users />{t("My Volunteer Activities")}<ArrowRight /></button></div>}
    <div className="profile-preference"><span>{t("Appearance")}</span><ThemeToggle mode={themeMode} onChange={onTheme} /></div>
    <div className="profile-preference"><span>{t('Language')}</span><LanguageSelector /></div>
    <div className="profile-links"><button onClick={() => onNavigate('about')}><CircleHelp />{t("Help & reporting guidelines")}<ArrowRight /></button><button onClick={onHotlines}><PhoneCall />{t("Emergency contacts")}<ArrowRight /></button></div>
    {isStaff && <div className="profile-links"><button onClick={() => onNavigate('review')}><ShieldCheck />{t("Staff moderation")}<ArrowRight /></button><a href={`${import.meta.env.BASE_URL}operations/`}><ShieldCheck />{t("Operations command")}<ArrowRight /></a></div>}
    {user && <button className="outline-button profile-logout" onClick={onSignOut}><LogOut size={18} />{t("Log out")}</button>}
    <p className="profile-privacy">{t("Your submissions and private evidence are available only to you and authorized staff.")}</p>
  </section>;
}

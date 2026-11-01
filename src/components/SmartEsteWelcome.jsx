import { t, languageCode } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import LanguageSelector from './LanguageSelector.jsx';
import { Activity, ArrowLeft, ArrowRight, Check, Compass, HeartHandshake, Inbox, MapPin, Plus, ShieldCheck, X } from 'lucide-react';
import useDialogFocus from '../lib/useDialogFocus.js';
import './smart-este-welcome.css';

const steps = [
  { title: 'See your community clearly.', label: 'Explore', icon: Compass, destination: 'map', action: 'Explore the map',
    text: 'Your community starts with a place. Explore Eastern Samar, find published concerns, and discover volunteer activities near you.',
    tips: ['Filter by municipality, category, status, or date.', 'Tap a report pin to read its details and location.', 'On your phone, tap Move map to pan, then Done moving to scroll.'],
    preview: 'map' },
  { title: 'Turn a concern into local action.', label: 'Report', icon: Plus, destination: 'report', action: 'Report a concern',
    text: 'Share what you observed so the community can understand the need. A clear, specific report gives reviewers a better starting point.',
    tips: ['Choose a category and explain what happened.', 'Add the municipality, an optional map pin, and relevant evidence.', 'Submit for moderation. New reports stay private until approved.'],
    preview: 'report' },
  { title: 'Follow your concern from here.', label: 'Track', icon: Inbox, destination: 'profile', action: 'Open My submissions',
    text: 'My submissions keeps your reports together, including concerns that are still waiting for review.',
    tips: ['Sign in and open My submissions, or Profile on your phone.', 'Check the review status and any resident-facing decision note.', 'A review decision is not an official government endorsement.'],
    preview: 'track' },
  { title: 'Lend a hand where it matters.', label: 'Volunteer', icon: HeartHandshake, destination: 'volunteers', action: 'Find volunteer activities',
    text: 'Find published activities, read what help is needed, and choose an opportunity that fits your time and skills.',
    tips: ['Browse schedules, locations, tasks, and available places.', 'Sign in to join an open activity or manage your registration.', 'My Activities shows your participation; recorded hours follow staff attendance review.'],
    preview: 'volunteer' },
  { title: 'See the bigger picture.', label: 'Impact', icon: Activity, destination: 'impact', action: 'View community impact',
    text: 'Community pulse brings published reports together so you can understand the concerns and places represented on the platform.',
    tips: ['See categories, municipality coverage, and report statuses.', 'Use the filters to focus on a place or a period.', 'No reports yet? Your community can help build the picture over time.'],
    preview: 'impact' },
];

function Preview({ type }) {
  useTranslation();
  return <div className={`smart-tour-preview is-${type}`} aria-hidden="true">
    {type === "map" ? <><div className="smart-preview-grid" /><svg className="smart-preview-coast" viewBox="0 0 240 180"><path d="m122 10 29 20-7 18 15 17-17 19 11 15-18 21 8 19-20 25-19-7 9-22-12-19 13-23-9-15 11-18-8-24Z" /><path d="m45 50 150 80M50 125 190 55" /></svg><MapPin className="smart-preview-pin pin-one" /><MapPin className="smart-preview-pin pin-two" /><span className="smart-preview-caption">{t("A place to start")}</span></>
      : type === "report" ? <div className="smart-preview-paper"><span><Plus size={18} />  {t("Your concern")}</span><i /><i /><div className="smart-preview-tags"><b>{t("Location")}</b><b>{t("Category")}</b></div><strong><ShieldCheck size={15} />  {t("Private until approved")}</strong></div>
        : type === "track" ? <div className="smart-preview-timeline">{['Submitted', 'Under review', 'Decision & updates'].map((item, i) => <span key={item}><b>{i === 0 ? <Check size={13} /> : i + 1}</b>{t(item)}</span>)}</div>
          : type === "volunteer" ? <div className="smart-preview-activity"><HeartHandshake size={46} /><strong>{t("Your time. Your community.")}</strong><span>{t("Discover · Join · Participate")}</span></div>
            : <div className="smart-preview-impact"><span>{t("Small actions.")}<br /><strong>{t("Shared progress.")}</strong></span><div>{[35, 57, 44, 78, 96].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div><small>{t("Explore the community picture")}</small></div>}
  </div>;
}

export default function SmartEsteWelcome({ name = '', needsConfirmation = false, exploring = false, onExplore, onResume, onFinish }) {
  useTranslation();
  const [step, setStep] = useState(0);
  const bodyRef = useRef(null);
  const headingRef = useRef(null);
  // The portal stays interactive while the application behind it is inert.
  useEffect(() => {
    if (exploring) return undefined;
    const root = document.getElementById('root');
    const previous = root?.inert;
    if (root) root.inert = true;
    return () => { if (root) root.inert = previous; };
  }, [exploring]);
  const dialogRef = useDialogFocus({ active: !exploring, onClose: () => onFinish() });
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (!exploring && step > 0) headingRef.current?.focus({ preventScroll: true });
  }, [step, exploring]);
  const current = steps[step - 1];
  const Icon = current?.icon;
  const displayName = name.trim().split(/\s+/)[0].slice(0, 40);

  if (exploring) return createPortal(<aside className="smart-tour-coach" role="region" aria-label={t("SMART ESTE tutorial in progress")}>
    <div><strong>{t("SMART ESTE · Step")} {step}  {t("of")} {steps.length}</strong><span>{t("Explore at your pace. Your tutorial is still here.")}</span></div>
    <button type="button" className="smart-coach-continue" onClick={onResume}>{t("Continue tutorial")} <ArrowRight size={16} /></button>
    <button type="button" className="smart-coach-end" aria-label={t("End tutorial")} onClick={() => onFinish()}><X size={18} /></button>
  </aside>, document.body);

  return createPortal(<div className="smart-tour-backdrop">
    <section className={`smart-tour-dialog${step === 0 ? ' is-welcome' : ''}`} role="dialog" aria-modal="true" aria-labelledby="smart-tour-title" aria-describedby="smart-tour-description" ref={dialogRef} tabIndex={-1}>
      <header className="smart-tour-header"><span><img src={`${import.meta.env.BASE_URL}community-mark.svg`} width="32" height="32" alt="" /><strong>{t("SMART ESTE")}</strong></span><button type="button" className="smart-tour-skip" onClick={() => onFinish()}>{t("Skip tour")} <X size={16} /></button><LanguageSelector compact /></header>
      <div className="smart-tour-body" ref={bodyRef}>
        {step === 0 ? <div className="smart-tour-intro">
          <div className="smart-welcome-art" aria-hidden="true"><span className="smart-orbit orbit-one" /><span className="smart-orbit orbit-two" /><span className="smart-orbit orbit-three" /><img src={`${import.meta.env.BASE_URL}community-mark.svg`} alt="" /><span className="smart-art-spark spark-one"><MapPin size={21} /></span><span className="smart-art-spark spark-two"><HeartHandshake size={21} /></span><span className="smart-art-spark spark-three"><ShieldCheck size={21} /></span></div>
          <div className="smart-welcome-copy"><span className="smart-tour-kicker">{t("LOCAL VOICES. SHARED ACTION.")}</span><p className="smart-tour-greeting">{displayName ? t("Maupay nga adlaw, {{value1}}!", { value1: displayName }) : t("Maupay nga adlaw!")}</p><h1 className={languageCode() === "war" ? "language-welcome" : undefined} id="smart-tour-title">{languageCode() === "war" ? t("Welcome to Eastern Samar Community Action Map!") : <>{t("Welcome to")}<br /><em>{t("SMART ESTE.")}</em></>}</h1><p id="smart-tour-description">{t("Your connection to community action in Eastern Samar. Find local needs, share a concern, and lend a hand.")}</p><span className="smart-tour-promise"><Compass size={16} />  {t("Five things you can do. One stronger community.")}</span></div>
        </div> : <>
          <nav className="smart-tour-progress" aria-label={t("Tutorial steps")}>{steps.map((item, index) => <button type="button" key={item.label} aria-current={step === index + 1 ? 'step' : undefined} aria-label={t("Step {{value1}}: {{value2}}", { value1: index + 1, value2: t(item.label) })} onClick={() => setStep(index + 1)}><b>{step > index + 1 ? <Check size={14} /> : index + 1}</b><span>{t(item.label)}</span></button>)}</nav>
          <div className="smart-tour-feature" key={step}><Preview type={current.preview} /><div className="smart-tour-feature-copy"><span className="smart-tour-kicker"><Icon size={15} /> {t(current.label)} · {step} / {steps.length}</span><h2 ref={headingRef} tabIndex={-1} id="smart-tour-title">{t(current.title)}</h2><p id="smart-tour-description">{t(current.text)}</p><ul>{current.tips.map((tip) => <li key={tip}><Check size={16} /><span>{t(tip)}</span></li>)}</ul><button type="button" className="smart-tour-feature-link" onClick={() => onExplore(current.destination)}>{t(current.action)}<ArrowRight size={16} /></button></div></div>
        </>}
        {needsConfirmation && <p className="smart-confirm-note"><ShieldCheck size={17} />  {t("Check your email to confirm your account before signing in to submit reports or join activities.")}</p>}
      </div>
      <footer className="smart-tour-footer"><span>{step === 0 ? t("A quick introduction, at your pace.") : t("Step {{value1}} of {{value2}} · Replay anytime from the footer.", { value1: step, value2: steps.length })}</span><div>{step > 0 && <button type="button" className="smart-tour-back" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={16} />{t("Back")}</button>}<button type="button" className="smart-tour-next" onClick={() => step === steps.length ? onFinish('map') : setStep((value) => value + 1)}>{step === 0 ? t("Show me around") : step === steps.length ? t("Start exploring") : t("Next")}<ArrowRight size={17} /></button></div></footer>
    </section>
  </div>, document.body);
}

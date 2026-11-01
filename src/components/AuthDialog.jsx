import { t } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ArrowLeft, ShieldCheck, X } from 'lucide-react';
import useDialogFocus from '../lib/useDialogFocus.js';
import { WELCOME_VERSION } from '../lib/onboarding.js';
import LanguageSelector from './LanguageSelector.jsx';
import { personalDataCollectionEnabled, collectionPauseMessage, collectionPolicy } from '../lib/collection-policy.js';

const copy = {
  'sign-in': {
    title: 'Sign in',
    action: 'Sign in',
    intro: 'From our barangays to our coastlines, Eastern Samar Community Action Map connects neighbors with local concerns, volunteer opportunities, and community action.',
  },
  'sign-up': {
    title: 'Create an account',
    action: 'Create account',
    intro: 'Join Estehanons helping families, barangays, and coastal communities protect our environment and respond to local concerns.',
  },
  recovery: {
    title: 'Reset your password',
    action: 'Send reset link',
    intro: 'We will send a recovery link to your email address so you can continue helping Eastern Samar communities.',
  },
  update: {
    title: 'Choose a new password',
    action: 'Update password',
    intro: 'Set a new password for your account and keep helping your community securely.',
  },
};

const authRedirectUrl = new URL(import.meta.env.BASE_URL, window.location.href).href;

function authErrorMessage(error) {
  const code = String(error?.code ?? '').toLowerCase();
  const message = String(error?.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || code === 'user_not_found' || message.includes('invalid login credentials')) {
    return 'The email or password is incorrect.';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Confirm your email address before signing in.';
  }
  if (error?.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (error?.name === 'AuthRetryableFetchError' || message.includes('fetch') || message.includes('network')) {
    return 'The account service could not be reached. Check your connection and try again.';
  }
  return 'We could not complete that account request. Check your details and try again.';
}

export default function AuthDialog({ supabase, initialMode = 'sign-in', onClose, onNotice, onAuthenticated, onAccountCreated }) {
  useTranslation();
  const [mode, setMode] = useState(collectionPolicy.kind === 'staging' ? 'sign-in' : initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useDialogFocus({ busy, onClose });
  const current = copy[mode];

  async function submit(event) {
    event.preventDefault();
    if (!personalDataCollectionEnabled) { setError(collectionPauseMessage); return; }
    if (collectionPolicy.kind === 'staging' && mode !== 'sign-in') { setError('Use your designated testing account.'); return; }
    setBusy(true);
    setError('');
    try {
      if (mode === 'sign-in') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        if (collectionPolicy.kind === 'staging') {
          const { data: access, error: accessError } = await supabase.rpc('staging_access');
          if (accessError || !access?.authorized || access.project_ref !== import.meta.env.VITE_STAGING_PROJECT_REF) {
            await supabase.auth.signOut({ scope: 'local' });
            setError('This account is not authorized for this testing environment.');
            return;
          }
        }
        onAuthenticated?.(data.user);
        onNotice('You are signed in. Reports will load from the shared database.');
        onClose();
      } else if (mode === 'sign-up') {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() || null, smart_este_welcome_version: WELCOME_VERSION },
            emailRedirectTo: authRedirectUrl,
          },
        });
        if (authError) throw authError;
        if (!data.session) {
          onNotice('Check your email to confirm your account before signing in.');
          if (onAccountCreated && data.user?.id && data.user?.identities?.length !== 0) {
            onClose();
            onAccountCreated(data.user, true);
          } else setMode('sign-in');
        } else {
          onNotice('Account created. Your profile is ready.');
          onClose();
          onAccountCreated?.(data.user, false);
        }
      } else if (mode === 'recovery') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: authRedirectUrl,
        });
        if (authError) throw authError;
        onNotice('If an account exists for that email, a recovery link is on its way.');
        onClose();
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        onNotice('Your password has been updated.');
        onClose();
      }
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    if (busy) return;
    setError('');
    setPassword('');
    setMode(nextMode);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => !busy && event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} tabIndex={-1} className="report-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" aria-busy={busy}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">{t("EASTERN SAMAR COMMUNITY ACTION")}</span>
            <h2 id="auth-dialog-title">{t(current.title)}</h2>
          </div>
          <LanguageSelector compact />
          <button className="icon-button" disabled={busy} onClick={onClose} aria-label={t("Close account dialog")}><X size={19} /></button>
        </div>
        <p className="modal-intro">{t(current.intro)}</p>
        <p className="modal-byline">{t("Developed by Julius Lorenzana")}</p>
        <form onSubmit={submit}>
          {mode === 'sign-up' && (
            <label className="field-label">{t("Display name")} <span className="optional-label">{t("Optional")}</span>
              <input autoComplete="name" maxLength="80" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
          )}
          {mode !== 'update' && (
            <label className="field-label">{t("Email")} <input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          )}
          {mode !== 'recovery' && (
            <label className="field-label">{mode === 'update' ? t("New password") : t("Password")}
              <input autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} type="password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} />
              {mode !== 'sign-in' && <span className="field-hint">{t("Use at least 8 characters.")}</span>}
            </label>
          )}
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <div className="modal-foot auth-modal-foot">
            <span><ShieldCheck size={14} />  {t("Account access is managed securely.")}</span>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? t("Please wait…") : t(current.action)}</button>
          </div>
        </form>
        <div className="auth-links">
          {mode === 'sign-in' && collectionPolicy.kind !== 'staging' && <>
            <button onClick={() => changeMode('sign-up')}>{t("Create an account")}</button>
            <button onClick={() => changeMode('recovery')}>{t("Forgot password?")}</button>
          </>}
          {mode === 'sign-up' && <button onClick={() => changeMode('sign-in')}><ArrowLeft size={13} />  {t("Back to sign in")}</button>}
          {mode === 'recovery' && <button onClick={() => changeMode('sign-in')}><ArrowLeft size={13} />  {t("Back to sign in")}</button>}
        </div>
      </section>
    </div>
  );
}

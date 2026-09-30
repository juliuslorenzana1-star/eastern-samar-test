import { useState } from 'react';
import { ArrowLeft, ShieldCheck, X } from 'lucide-react';

const copy = {
  'sign-in': { title: 'Sign in', action: 'Sign in', intro: 'Access your reports and community review tools.' },
  'sign-up': { title: 'Create an account', action: 'Create account', intro: 'Your account lets you submit concerns and follow their status.' },
  recovery: { title: 'Reset your password', action: 'Send reset link', intro: 'We will send a recovery link to your email address.' },
  update: { title: 'Choose a new password', action: 'Update password', intro: 'Set a new password for your account.' },
};

const authRedirectUrl = new URL(import.meta.env.BASE_URL, window.location.href).href;

export default function AuthDialog({ supabase, initialMode = 'sign-in', onClose, onNotice }) {
  const [mode, setMode] = useState(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = copy[mode];

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'sign-in') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        onNotice('You are signed in. Reports will load from the shared database.');
        onClose();
      } else if (mode === 'sign-up') {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() || null },
            emailRedirectTo: authRedirectUrl,
          },
        });
        if (authError) throw authError;
        if (!data.session) {
          onNotice('Check your email to confirm your account before signing in.');
          setMode('sign-in');
        } else {
          onNotice('Account created. Your profile is ready.');
          onClose();
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
      setError(authError.message || 'We could not complete that request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setError('');
    setPassword('');
    setMode(nextMode);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="report-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
        <div className="modal-head">
          <div>
            <span className="eyebrow">EASTERN SAMAR COMMUNITY ACTION</span>
            <h2 id="auth-dialog-title">{current.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close account dialog"><X size={19} /></button>
        </div>
        <p className="modal-intro">{current.intro}</p>
        <form onSubmit={submit}>
          {mode === 'sign-up' && (
            <label className="field-label">Display name <span className="optional-label">Optional</span>
              <input autoComplete="name" maxLength="80" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
          )}
          {mode !== 'update' && (
            <label className="field-label">Email
              <input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          )}
          {mode !== 'recovery' && (
            <label className="field-label">{mode === 'update' ? 'New password' : 'Password'}
              <input autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} type="password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} />
              {mode !== 'sign-in' && <span className="field-hint">Use at least 8 characters.</span>}
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-foot auth-modal-foot">
            <span><ShieldCheck size={14} /> Account access is managed securely.</span>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : current.action}</button>
          </div>
        </form>
        <div className="auth-links">
          {mode === 'sign-in' && <>
            <button onClick={() => changeMode('sign-up')}>Create an account</button>
            <button onClick={() => changeMode('recovery')}>Forgot password?</button>
          </>}
          {mode === 'sign-up' && <button onClick={() => changeMode('sign-in')}><ArrowLeft size={13} /> Back to sign in</button>}
          {mode === 'recovery' && <button onClick={() => changeMode('sign-in')}><ArrowLeft size={13} /> Back to sign in</button>}
        </div>
      </section>
    </div>
  );
}

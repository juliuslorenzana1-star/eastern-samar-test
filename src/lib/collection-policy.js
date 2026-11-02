// Environment checks prevent accidental production writes, not malicious clients.
// Staging also requires server allowlisting, RLS and closed Auth signup.
export function resolveCollectionPolicy(env = {}) {
  const url = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const ref = env.VITE_STAGING_PROJECT_REF;
  const kind = env.VITE_APP_ENVIRONMENT || 'public';
  const protectedRefs = ['xoitncotbgobcsdmvyjb', 'egqoczyvhwtujwaflmgz', 'ztsmtwnmirlqzgnnmuuh'];
  const local = url === 'http://127.0.0.1:54321';
  const isolated = kind === 'staging' && (local || /^[a-z]{20}$/.test(ref || '') && url === `https://${ref}.supabase.co` && !protectedRefs.includes(ref));
  const fixtures = url === 'https://demo.invalid' || kind === 'fixtures' && url === 'https://qa-fixtures.supabase.co';
  const publicApproved = kind === 'public' && env.VITE_PUBLIC_REPORTING_RELEASE_APPROVED === 'true'
    && env.VITE_PUBLIC_PROJECT_REF === 'xoitncotbgobcsdmvyjb'
    && url === 'https://xoitncotbgobcsdmvyjb.supabase.co';
  return { kind: isolated ? 'staging' : fixtures ? 'fixtures' : 'public', isolated, publicApproved, writable: fixtures || (isolated || publicApproved) && env.VITE_ENABLE_PERSONAL_DATA_COLLECTION === 'true' };
}
export function resolveVisitorReporting(env={}) {
  const policy=resolveCollectionPolicy(env);
  return env.VITE_ENABLE_ANONYMOUS_REPORTING === 'true' && (policy.isolated || policy.publicApproved);
}
export const collectionPolicy = resolveCollectionPolicy(import.meta.env);
export const personalDataCollectionEnabled = collectionPolicy.writable;
// Separate opt-in: legacy account workflows and fictional rehearsals stay intact.
// Public activation requires an explicitly approved release on the server too.
export const visitorReportingEnabled = resolveVisitorReporting(import.meta.env);
export const collectionPauseMessage = 'Public submissions are temporarily unavailable while privacy requirements are being completed.';
export function requirePersonalDataCollection() {
  if (!personalDataCollectionEnabled) throw new Error(collectionPauseMessage);
}

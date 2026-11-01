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
  return { kind: isolated ? 'staging' : fixtures ? 'fixtures' : 'public', isolated, writable: fixtures || isolated && env.VITE_ENABLE_PERSONAL_DATA_COLLECTION === 'true' };
}
export const collectionPolicy = resolveCollectionPolicy(import.meta.env);
export const personalDataCollectionEnabled = collectionPolicy.writable;
export const collectionPauseMessage = 'Public submissions are paused pending privacy readiness. Authorized testing uses a separate restricted environment.';
export function requirePersonalDataCollection() {
  if (!personalDataCollectionEnabled) throw new Error(collectionPauseMessage);
}

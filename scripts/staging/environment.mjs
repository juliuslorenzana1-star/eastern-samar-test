import { loadEnv } from 'vite';
import { resolveCollectionPolicy } from '../../src/lib/collection-policy.js';
import { assertSafeClientEnv } from '../client-env.mjs';
export function stagingEnvironment() {
  const env={...loadEnv('staging',process.cwd(),''),...process.env};
  assertSafeClientEnv(env);
  const policy=resolveCollectionPolicy(env);
  if(!policy.isolated||!policy.writable)throw Error('Staging is not configured: a separate project identity and explicit staging opt-in are required. Production is protected.');
  if(env.VITE_ENABLE_AI_SCREENING==='true'||env.VITE_ENABLE_EMAIL_NOTIFICATIONS==='true')throw Error('AI/email functions must remain disabled for this testing setup.');
  if(!env.VITE_SUPABASE_PUBLISHABLE_KEY)throw Error('A separate staging publishable key is required.');
  return env;
}
export async function checkClosedSignup(env) {
  const response=await fetch(env.VITE_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Cannot verify staging Auth configuration.');
  const settings=await response.json();
  if(settings.disable_signup!==true)throw Error('Public signup must be disabled on the isolated backend before testing.');
  if(settings.external?.anonymous_users===true)throw Error('Anonymous sign-in must be disabled before testing.');
}

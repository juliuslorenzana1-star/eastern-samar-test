import { resolveCollectionPolicy } from '../src/lib/collection-policy.js';

export function assertSafeClientEnv(env) {
  if (env.VITE_APP_ENVIRONMENT === 'staging' && !resolveCollectionPolicy(env).isolated) {
    throw new Error('Staging must use a separate approved project reference or loopback Supabase; existing application projects are protected.');
  }
  for (const [name,value] of Object.entries(env)) {
    if (!name.startsWith('VITE_') || !value) continue;
    if (/OPENAI|ANTHROPIC|RESEND|AI_API|SERVICE_ROLE|SECRET|PRIVATE_KEY|ACCESS_TOKEN|HMAC/i.test(name)
      || /^(sk-|sb_secret_|re_[A-Za-z0-9]{20,}|gh[pousr]_|github_pat_)/.test(String(value))) {
      throw new Error('Secret credentials must not be configured in VITE_ client environment variables.');
    }
    if (/SERVICE_ROLE|SECRET_KEY/.test(name) || String(value).startsWith('sb_secret_')) throw new Error('Secret credentials must not be configured in VITE_ client environment variables.');
    if (/SUPABASE.*KEY/.test(name) && String(value).split('.').length===3) {
      try {
        const claims=JSON.parse(Buffer.from(String(value).split('.')[1],'base64url').toString());
        if (claims.role && claims.role!=='anon') throw new Error('Supabase client credentials must use the anon role or a publishable key.');
      } catch(error) {
        if(error.message.includes('Supabase client credentials'))throw error;
      }
    }
  }
}

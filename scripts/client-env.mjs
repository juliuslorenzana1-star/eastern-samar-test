export function assertSafeClientEnv(env) {
  for (const [name,value] of Object.entries(env)) {
    if (!name.startsWith('VITE_') || !value) continue;
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

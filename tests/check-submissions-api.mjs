// Read-only anonymous capability check; never prints environment values or rows.
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const env = loadEnv('development', root, 'VITE_');
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase client configuration is unavailable.');
const response = await fetch(`${url}/rest/v1/rpc/my_reports`, {
  method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
  body: '{}', signal: AbortSignal.timeout(10000),
});
const result = await response.json();
console.log(JSON.stringify({ check: 'my_reports_anonymous_capability', httpStatus: response.status, errorCode: result?.code || null }));

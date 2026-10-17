// Explicit, opt-in integration test. Writes exactly 26 private pending reports.
// Pass dedicated resident test credentials as JSON on stdin, never arguments.
// No evidence, email notifications, automated screening, or geographic pins.
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

if (!process.argv.includes('--execute')) {
  throw new Error('This test writes 26 reports. Run with --execute only after authorization.');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const env = loadEnv('development', root, 'VITE_');
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase client configuration unavailable.');
let input = '';
for await (const chunk of process.stdin) input += chunk;
const credentials = JSON.parse(input);
if (!credentials.email?.endsWith('@example.invalid') || !credentials.userId || !credentials.password) {
  throw new Error('Use a dedicated, non-deliverable resident test account.');
}
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const client = createClient(url, key, options);
const anonymous = createClient(url, key, options);
const { data: login, error: loginError } = await client.auth.signInWithPassword({
  email: credentials.email, password: credentials.password,
});
credentials.password = '';
input = '';
if (loginError || login.user?.id !== credentials.userId) {
  throw new Error(`Dedicated test-account sign-in failed (${loginError?.code || 'identity mismatch'}).`);
}
try {
  const { data: profile, error: profileError } = await client.from('profiles')
    .select('id,role,display_name').eq('id', credentials.userId).single();
  if (profileError || profile?.role !== 'resident' || !profile.display_name?.startsWith('[TEST]')) {
    throw new Error('Concurrency test requires its dedicated resident profile.');
  }
  const { data: categories, error: categoryError } = await client.from('report_categories')
    .select('slug').eq('active', true).order('sort_order');
  if (categoryError || !categories?.length) throw new Error('Could not load existing categories.');
  const municipalities = ['Arteche', 'Balangiga', 'Balangkayan', 'Borongan City', 'Can-avid', 'Dolores',
    'General MacArthur', 'Giporlos', 'Guiuan', 'Hernani', 'Jipapad', 'Lawaan', 'Llorente', 'Maslog',
    'Maydolong', 'Mercedes', 'Oras', 'Quinapondan', 'Salcedo', 'San Julian', 'San Policarpo', 'Sulat', 'Taft'];
  const batch = `concurrency-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${randomUUID().slice(0, 8)}`;
  const titlePrefix = `[TEST ${batch}]`;
  const barrier = Promise.withResolvers();
  const started = [];
  const globalStart = performance.now();
  const tasks = Array.from({ length: 26 }, (_, index) => (async () => {
    await barrier.promise;
    const begin = performance.now();
    started.push(begin - globalStart);
    const { data, error } = await client.from('reports').insert({
      title: `${titlePrefix} Report ${String(index + 1).padStart(2, '0')} of 26`,
      description: `SYNTHETIC TEST RECORD, not a real community concern. Authorized 26-request concurrency test. Batch ${batch}; submission ${index + 1}/26. Municipality is a test filter value. No actual incident, evidence, or location is asserted. Keep private and pending review.`,
      category_slug: categories[index % categories.length].slug,
      municipality: municipalities[index % municipalities.length],
      priority: 'normal',
    }).select('id,title,status,is_public').single();
    return { index: index + 1, id: data?.id ?? null, status: data?.status ?? null,
      is_public: data?.is_public ?? null, elapsed_ms: Math.round(performance.now() - begin),
      error_code: error?.code ?? null, success: !error && Boolean(data?.id) };
  })());
  barrier.resolve();
  const settled = await Promise.allSettled(tasks);
  const results = settled.map((result, index) => result.status === 'fulfilled' ? result.value : {
    index: index + 1, success: false, error_code: 'transport_failure',
  });
  const successful = results.filter((result) => result.success);
  const ids = successful.map((result) => result.id);
  const [persisted, publicRead, events] = ids.length ? await Promise.all([
    client.from('reports').select('id,status,is_public').in('id', ids),
    anonymous.from('reports').select('id').in('id', ids),
    client.from('report_events').select('id,report_id,status').in('report_id', ids),
  ]) : [];
  const durations = successful.map((result) => result.elapsed_ms).sort((a, b) => a - b);
  const percentile = (quantile) => durations.length ? durations[Math.min(durations.length - 1, Math.ceil(durations.length * quantile) - 1)] : null;
  const summary = {
    batch, created_at: new Date().toISOString(), test_user_id: credentials.userId,
    requested: 26, succeeded: successful.length, failed: results.length - successful.length,
    launch_spread_ms: Math.round((Math.max(...started) - Math.min(...started)) * 100) / 100,
    total_elapsed_ms: Math.round(performance.now() - globalStart),
    latency_ms: { min: durations[0] ?? null, median: percentile(0.5), p95: percentile(0.95), max: durations.at(-1) ?? null },
    persisted_count: persisted?.data?.length ?? null,
    all_private_pending: !persisted?.error && persisted?.data?.length === 26
      && persisted.data.every((report) => report.status === 'pending_review' && report.is_public === false),
    anonymous_visible_count: publicRead?.data?.length ?? null,
    anonymous_check_ok: !publicRead?.error && publicRead?.data?.length === 0,
    status_event_count: events?.data?.length ?? null,
    event_check_ok: !events?.error && events?.data?.length === 26
      && events.data.every((event) => event.status === 'pending_review'),
    location_policy: 'No geographic coordinates supplied; no simulated incidents appear on the map.',
    results,
  };
  summary.passed = summary.succeeded === 26 && summary.all_private_pending && summary.anonymous_check_ok && summary.event_check_ok;
  const directory = new URL('../test-results.local/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(`${batch}.json`, directory), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  if (!summary.passed) process.exitCode = 1;
} finally {
  await client.auth.signOut({ scope: 'global' });
}

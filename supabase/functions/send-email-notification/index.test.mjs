import { test } from 'node:test';
import assert from 'node:assert/strict';

let handler;
const env = { SUPABASE_URL: 'https://database.test', SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service', RESEND_API_KEY: 'test-resend', EMAIL_FROM_ADDRESS: 'Civic <mail@example.test>', APP_URL: 'https://app.example.test' };
globalThis.Deno = { env: { get: (key) => env[key] }, serve: (callback) => { handler = callback; } };
await import('./index.ts');
const reference = '11111111-1111-4111-8111-111111111111';
const calls = [];
let claimStatus = 'claimed', owned = true, providerOk = true;
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, options });
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
  if (url.endsWith('/auth/v1/user')) return json({ id: reference, email: 'private@example.test' });
  if (url.includes('/profiles?')) return json([{ display_name: '<script>name</script>' }]);
  if (url.includes('/reports?')) return json(owned ? [{ id: reference, title: '<img src=x>', category_slug: 'environment', municipality: 'Borongan City', barangay: 'Test', created_at: '2026-10-14T00:00:00Z', status: 'pending_review' }] : []);
  if (url.includes('/report_categories?')) return json([{ name: 'Environment' }]);
  if (url.includes('/volunteer_registrations?')) return json([{ id: reference, status: 'registered', opportunity: { title: 'Coastal activity', municipality: 'Guiuan', tasks: [], what_to_bring: [] } }]);
  if (url.endsWith('/rpc/claim_email_notification')) return json(claimStatus);
  if (url === 'https://api.resend.com/emails') return json(providerOk ? { id: 'provider-reference' } : { error: 'sensitive provider error' }, providerOk ? 200 : 500);
  if (url.includes('/email_notification_log?')) return new Response(null, { status: 204 });
  throw new Error('Unexpected request');
};
function request(body, authenticated = true) {
  return new Request('https://function.test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer test-session' } : {}) }, body: JSON.stringify(body) });
}
const payload = { type: 'report_submission', report_id: reference, report_title: 'UNTRUSTED INPUT' };
test('requires authentication', async () => {
  calls.length = 0;
  assert.equal((await handler(request(payload, false))).status, 401);
  assert.equal(calls.length, 0);
});
test('validates record identifiers before querying records', async () => {
  calls.length = 0;
  assert.equal((await handler(request({ ...payload, report_id: 'invalid' }))).status, 400);
  assert.equal(calls.some(({ url }) => url.includes('/reports?')), false);
});
test('rejects records not owned by the caller', async () => {
  owned = false; calls.length = 0;
  assert.equal((await handler(request(payload))).status, 404);
  assert.equal(calls.some(({ url }) => url.includes('resend.com')), false);
  owned = true;
});
test('uses escaped stored data, stable idempotency and acceptance language', async () => {
  calls.length = 0;
  const result = await (await handler(request(payload))).json();
  assert.equal(result.accepted, true);
  assert.equal(result.delivered, undefined);
  const email = calls.find(({ url }) => url.includes('resend.com'));
  const message = JSON.parse(email.options.body);
  assert.match(message.html, /&lt;script&gt;/);
  assert.equal(message.html.includes('UNTRUSTED INPUT'), false);
  assert.match(message.html, /#submission=/);
  assert.equal(email.options.headers['Idempotency-Key'], 'report_submission/' + reference);
});
test('durable reservation blocks repeated provider calls', async () => {
  calls.length = 0; claimStatus = 'accepted';
  assert.equal((await (await handler(request(payload))).json()).duplicate, true);
  assert.equal(calls.some(({ url }) => url.includes('resend.com')), false);
  claimStatus = 'claimed';
});
test('rate-limited accounts cannot send', async () => {
  calls.length = 0; claimStatus = 'rate_limited';
  assert.equal((await handler(request(payload))).status, 429);
  assert.equal(calls.some(({ url }) => url.includes('resend.com')), false);
  claimStatus = 'claimed';
});
test('does not leak provider errors or claim success', async () => {
  providerOk = false;
  const response = await handler(request(payload));
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes('sensitive'), false);
  providerOk = true;
});
test('volunteer email reflects stored registration status', async () => {
  calls.length = 0;
  await handler(request({ type: 'volunteer_registration', opportunity_id: reference }));
  const email = JSON.parse(calls.find(({ url }) => url.includes('resend.com')).options.body);
  assert.match(email.html, /registered/);
  assert.equal(email.html.includes('You are confirmed'), false);
});

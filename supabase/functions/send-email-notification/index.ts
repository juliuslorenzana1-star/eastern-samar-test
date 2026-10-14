const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (value: string) => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'To be announced';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');
    if (!url || !anon || !service) return reply({ error: 'service_unavailable' }, 503);
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'unauthorized' }, 401);
    const auth = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: authorization }, signal: AbortSignal.timeout(10000) });
    if (!auth.ok) return reply({ error: 'unauthorized' }, 401);
    const user = await auth.json();
    let body;
    try { body = await request.json(); } catch { return reply({ error: 'invalid_request' }, 400); }
    const type = body?.type;
    if (!['report_submission', 'volunteer_registration'].includes(type)) return reply({ error: 'invalid_request' }, 400);
    const id = type === 'report_submission' ? body.report_id : body.opportunity_id;
    if (typeof id !== 'string' || !uuid.test(id)) return reply({ error: 'invalid_reference' }, 400);
    async function read(table: string, query: string) {
      const response = await fetch(url + '/rest/v1/' + table + '?' + query, { headers: { apikey: anon!, Authorization: authorization! }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('lookup_failed');
      return response.json();
    }
    const profiles = await read('profiles', 'id=eq.' + user.id + '&select=display_name');
    let reference: string, title: string, details: [string, unknown][], steps: string, fragment: string;
    if (type === 'report_submission') {
      const records = await read('reports', 'id=eq.' + id + '&reporter_id=eq.' + user.id + '&select=id,title,category_slug,municipality,barangay,created_at,status');
      const report = records[0];
      if (!report) return reply({ error: 'record_not_found' }, 404);
      const categories = await read('report_categories', 'slug=eq.' + encodeURIComponent(report.category_slug) + '&select=name');
      reference = report.id; title = 'Your concern was received';
      details = [['Report reference', reference], ['Concern', report.title], ['Category', categories[0]?.name || report.category_slug], ['Location', [report.barangay, report.municipality].filter(Boolean).join(', ')], ['Submitted (Philippine time)', date(report.created_at)], ['Initial review status', 'Pending review'], ['Current status', report.status.replaceAll('_', ' ')]];
      steps = 'Submission does not mean approval or public publication. Authorized moderators review your concern before it can appear on the public map.';
      fragment = 'submission=' + reference;
    } else {
      const records = await read('volunteer_registrations', 'opportunity_id=eq.' + id + '&volunteer_id=eq.' + user.id + '&select=id,status,opportunity:volunteer_opportunities(title,municipality,barangay,location,starts_at,what_to_bring,tasks)');
      const registration = records[0], activity = registration?.opportunity;
      if (!activity) return reply({ error: 'record_not_found' }, 404);
      reference = registration.id; title = 'Your volunteer registration was recorded';
      details = [['Registration reference', reference], ['Activity', activity.title], ['Location', [activity.barangay, activity.municipality, activity.location].filter(Boolean).join(', ') || 'To be announced'], ['Schedule (Philippine time)', date(activity.starts_at)], ['Registration status', registration.status.replaceAll('_', ' ')]];
      steps = 'Registration is not a guarantee of approval or attendance credit. Check organizer updates. ' + [...(activity.what_to_bring || []), ...(activity.tasks || [])].slice(0, 4).join('; ');
      fragment = 'volunteer=' + id;
    }
    const apiKey = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('EMAIL_FROM_ADDRESS'), appUrl = Deno.env.get('APP_URL');
    if (!apiKey || !from || !appUrl || !user.email) return reply({ ok: false, skipped: true, reason: 'email_not_configured' });
    const link = new URL(appUrl);
    if (link.protocol !== 'https:' && link.hostname !== 'localhost') return reply({ error: 'invalid_app_configuration' }, 503);
    link.hash = fragment;
    const adminHeaders = { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json' };
    const claim = await fetch(url + '/rest/v1/rpc/claim_email_notification', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ p_user_id: user.id, p_type: type, p_reference: reference }), signal: AbortSignal.timeout(10000) });
    if (!claim.ok) return reply({ error: 'notification_storage_unavailable' }, 503);
    const status = await claim.json();
    if (status === 'rate_limited') return reply({ error: 'rate_limited' }, 429);
    if (status !== 'claimed') return reply({ ok: false, duplicate: true, status });
    const html = '<div style="font-family:Arial,sans-serif;background:#faf9f3;color:#243b34;padding:28px;border-top:3px solid #a17a35"><small>EASTERN SAMAR COMMUNITY ACTION MAP</small><h1>' + escape(title) + '</h1><p>Hello ' + escape(profiles[0]?.display_name || 'Community member') + ',</p><dl>' + details.map(([label, value]) => '<dt><strong>' + escape(label) + '</strong></dt><dd style="margin:4px 0 16px">' + escape(value) + '</dd>').join('') + '</dl><p>' + escape(steps) + '</p><a href="' + escape(link.href) + '">View in the community platform</a></div>';
    let state = 'uncertain', providerId = null;
    try {
      const sent = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Idempotency-Key': type + '/' + reference }, body: JSON.stringify({ from, to: [user.email], subject: title, html }), signal: AbortSignal.timeout(15000) });
      state = sent.ok ? 'accepted' : 'failed';
      if (sent.ok) providerId = (await sent.json()).id || null;
    } catch { /* Unknown outcomes remain reserved; never blindly resend. */ }
    const logged = await fetch(url + '/rest/v1/email_notification_log?notification_type=eq.' + type + '&reference_id=eq.' + reference, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ status: state, provider_id: providerId }), signal: AbortSignal.timeout(10000) });
    if (!logged.ok) console.error('notification_log_update_failed');
    console.info('notification_result', { type, status: state });
    return reply({ ok: state === 'accepted', accepted: state === 'accepted', status: state }, state === 'accepted' ? 200 : 502);
  } catch {
    console.error('notification_request_failed');
    return reply({ error: 'notification_unavailable' }, 503);
  }
});

// Entirely fictional, in-memory rehearsal transport. Never a production backend.
export const DEMO_ORIGIN = 'https://demo.invalid';
export const DEMO_KEY = 'sb_publishable_local_demonstration_only';
export const residentId = 'aa111111-1111-4111-8111-111111111111';
const staffId = 'aa222222-2222-4222-8222-222222222222';
export const activityId = 'cc111111-1111-4111-8111-111111111111';
export function demoSession(role = 'resident') {
  const id = role === 'moderator' ? staffId : residentId;
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const user = { id, email: `${role}@example.invalid`, role: 'authenticated', aud: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {} };
  return { user, access_token: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp })).toString('base64url')}.demo-only`, refresh_token: 'demo-only', expires_at: exp, expires_in: 86400, token_type: 'bearer' };
}
export function createDemoState() {
  const now = new Date().toISOString();
  const opportunity = { id: activityId, title: '[DEMO] Borongan coastal clean-up', description: 'Fictional rehearsal activity. Help document and collect litter safely with a demonstration community group.', category: 'environment', municipality: 'Borongan City', barangay: 'Demonstration area', location: 'Fictional meeting point — not a real event', latitude: 11.608, longitude: 125.43, status: 'published', registration_open: true, capacity: 12, skills: [], tasks: ['Record collected litter', 'Follow the activity safety briefing'], what_to_bring: ['Reusable water bottle', 'Protective gloves'], organizer_name: 'Demonstration community group', organizer_id: staffId, starts_at: new Date(Date.now() + 7 * 86400000).toISOString(), ends_at: new Date(Date.now() + 7 * 86400000 + 7200000).toISOString(), created_at: now };
  return { reports: [], evidence: [], locations: [], events: [], registrations: [], writes: [], blocked: [], opportunity };
}
export async function installDemoTransport(context, state, localOrigin, providerOrigin = DEMO_ORIGIN) {
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === localOrigin) return route.continue();
    if (url.origin !== providerOrigin) { state.blocked.push(url.origin); return route.abort('blockedbyclient'); }
    const path = url.pathname, method = req.method();
    const staff = req.headers().authorization === `Bearer ${demoSession('moderator').access_token}`
      || (() => { try { return JSON.parse(Buffer.from((req.headers().authorization || '').split('.')[1], 'base64url')).sub === staffId; } catch { return false; } })();
    const user = demoSession(staff ? 'moderator' : 'resident').user;
    const body = ['POST', 'PATCH', 'PUT'].includes(method) && req.headers()['content-type']?.includes('json') ? req.postDataJSON() : {};
    let data = [], status = 200;
    const respond = () => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': localOrigin } });
    if (method === 'OPTIONS') return respond();
    if (path.startsWith('/functions/')) { data = { error: 'Optional API calls are forbidden in rehearsal' }; status = 403; return respond(); }
    if (method !== 'GET') state.writes.push({ path, method });
    if (path === '/auth/v1/user') data = user;
    else if (path === '/auth/v1/token') data = demoSession(staff ? 'moderator' : 'resident');
    else if (path === '/auth/v1/logout') data = {};
    else if (path.endsWith('/profiles')) { const profile = { id: user.id, display_name: staff ? 'Demo Moderator' : 'Demo Resident', role: staff ? 'moderator' : 'resident', show_on_leaderboard: false, public_alias: null }; data = url.searchParams.has('id') ? profile : [profile]; }
    else if (path.endsWith('/report_categories')) data = ['environment', 'infrastructure', 'public-safety', 'health', 'education', 'transportation', 'community-services', 'youth', 'disaster-emergency', 'other'].map((slug, index) => ({ slug, name: slug === 'environment' ? 'Environment' : slug.replaceAll('-', ' '), sort_order: index, active: true }));
    else if (path.endsWith('/reports')) {
      if (method === 'POST') {
        const report = { ...body, id: crypto.randomUUID(), reporter_id: residentId, status: 'pending_review', is_public: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        state.reports.push(report); data = report;
      } else data = state.reports.filter(report => staff || (url.searchParams.get('is_public') === 'eq.true' ? report.is_public : report.reporter_id === user.id));
    }
    else if (path.endsWith('/rpc/my_reports')) data = state.reports.filter(report => report.reporter_id === user.id);
    else if (path.endsWith('/rpc/moderate_report')) {
      if (!staff) { status = 403; data = { message: 'Demo role denied' }; }
      else {
        const report = state.reports.find(item => item.id === body.target_report_id);
        if (!report) { status = 404; data = { message: 'Demo report not found' }; }
        else { report.status = body.next_status; report.priority = body.next_priority; report.is_public = ['approved','verified','in_progress','resolved'].includes(report.status); report.updated_at = new Date().toISOString(); if (report.status === 'verified') report.verified_at = report.updated_at; state.events.push({ id: crypto.randomUUID(), report_id: report.id, status: report.status, created_at: report.updated_at }); data = null; }
      }
    }
    else if (path.endsWith('/rpc/report_progress')) data = state.events.filter(event => event.report_id === body.target_report_id).map(({ id, status, created_at }) => ({ id, status, created_at }));
    else if (path.endsWith('/report_private_locations')) { if (method === 'POST') state.locations.push(body); data = []; }
    else if (path.startsWith('/storage/v1/object/sign/')) data = { signedURL: '/object/demo-evidence.png' };
    else if (path.startsWith('/storage/v1/object/')) { data = { Key: path }; }
    else if (path.endsWith('/report_evidence')) { if (method === 'POST') state.evidence.push({ ...body, id: crypto.randomUUID(), created_at: new Date().toISOString() }); data = state.evidence.filter(item => url.searchParams.get('report_id') === `eq.${item.report_id}`); }
    else if (path.endsWith('/volunteer_opportunities')) data = [state.opportunity];
    else if (path.endsWith('/rpc/join_volunteer_opportunity')) {
      if (!state.registrations.length) state.registrations.push({ id: crypto.randomUUID(), opportunity_id: activityId, volunteer_id: user.id, status: 'registered', joined_at: new Date().toISOString(), opportunity: state.opportunity }); data = state.registrations[0].id;
    }
    else if (path.endsWith('/volunteer_registrations')) data = state.registrations;
    else if (path.endsWith('/rpc/get_volunteer_signup_counts')) data = [{ opportunity_id: activityId, signup_count: state.registrations.length }];
    else if (path.endsWith('/rpc/get_volunteer_community_totals')) data = [{ volunteers_joined: state.registrations.length, community_hours: 0 }];
    else if (path.endsWith('/rpc/platform_statistics')) data = [{ total_reports: state.reports.filter(item => item.is_public).length, verified_reports: state.reports.filter(item => item.status === 'verified').length, resolved_reports: 0 }];
    else if (['ai_review_runs','ai_review_flags','platform_audit'].some(table => path.endsWith('/' + table)) || path.endsWith('/rpc/get_public_leaderboard') || path.endsWith('/rpc/my_volunteer_summary')) data = [];
    else { status = 404; data = { message: 'Not implemented in isolated rehearsal', code: 'DEMO_ONLY' }; }
    return respond();
  });
}
export async function installDemoPresentation(context) {
  await context.addInitScript(({ resident, moderator }) => {
    if (location.origin !== 'http://127.0.0.1:5184') return;
    const role = localStorage.getItem('escam.demo.role') || 'resident';
    if (role === 'guest') localStorage.removeItem('sb-demo-auth-token');
    else localStorage.setItem('sb-demo-auth-token', JSON.stringify(role === 'moderator' ? moderator : resident));
    localStorage.setItem('escam.theme-mode', 'light');
    window.addEventListener('DOMContentLoaded', () => {
      const bar = document.createElement('div'); bar.id = 'demo-safety-banner';
      bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:100000;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:8px 12px;background:#0b2635;color:white;font:13px system-ui;border-top:3px solid #36c4af';
      const label = document.createElement('strong'); label.textContent = 'ISOLATED DEMONSTRATION · FICTIONAL DATA · LOCAL BUILD'; bar.append(label);
      const select = document.createElement('select'); select.setAttribute('aria-label', 'Demonstration role');
      for (const name of ['resident', 'moderator', 'guest']) { const option = document.createElement('option'); option.value = name; option.textContent = `Demo ${name}`; select.append(option); } select.value = role;
      select.addEventListener('change', () => { localStorage.setItem('escam.demo.role', select.value); location.href = select.value === 'moderator' ? '/operations/' : '/'; });
      bar.append(select); document.body.append(bar);
    });
  }, { resident: demoSession(), moderator: demoSession('moderator') });
}

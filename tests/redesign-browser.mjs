// Browser fixtures are intercepted locally. No production accounts or records are modified.
import { chromium } from 'playwright-core';
import { loadEnv } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.UI_TEST_URL || 'http://localhost:5178/';
const env = loadEnv('development', process.cwd(), 'VITE_');
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const user = { id: 'aa111111-1111-4111-8111-111111111111', email: 'redesign@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: { provider: 'email' } };
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp })).toString('base64url')}.local-fixture`;
const session = { user, access_token: token, refresh_token: 'local-fixture', token_type: 'bearer', expires_at: exp, expires_in: 3600 };
const categories = [{ slug: 'environment', name: 'Environment', active: true }, { slug: 'infrastructure', name: 'Infrastructure', active: true }, { slug: 'disaster-emergency', name: 'Disaster and Emergency', active: true }];
const report = { id: 'bb111111-1111-4111-8111-111111111111', title: 'Local fixture: Coastal litter', description: 'Local browser fixture only. No real report or production database write.', category_slug: 'environment', municipality: 'Borongan City', barangay: 'Punta Maria', latitude: 11.60806, longitude: 125.43194, priority: 'normal', status: 'verified', is_public: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
const opportunity = { id: 'cc111111-1111-4111-8111-111111111111', title: 'Local fixture: Community cleanup', description: 'Browser-only volunteer activity fixture.', category: 'environment', municipality: 'Borongan City', barangay: 'Punta Maria', status: 'published', registration_open: true, starts_at: new Date(Date.now() + 86400000 * 7).toISOString(), capacity: 5 };
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
await mkdir('test-results.local/redesign', { recursive: true });
const results = [];
async function createPage(width, height, { signedIn = false, staff = false, theme = 'dark', empty = false, ownReport = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', geolocation: { latitude: 11.608, longitude: 125.432 }, permissions: ['geolocation'] });
  const page = await context.newPage();
  const errors = [], writes = [];
  let failInsert = false, failJoin = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ storageKey, session, signedIn, theme }) => { localStorage.setItem('escam.theme-mode', theme); if (signedIn) localStorage.setItem(storageKey, JSON.stringify(session)); }, { storageKey, session, signedIn, theme });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://*.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url());
    let data = [];
    if (url.pathname.endsWith('/profiles')) { const profile = { id: user.id, display_name: 'Local QA Resident', role: staff ? 'admin' : 'resident' }; data = url.searchParams.has('id') ? profile : [profile]; }
    else if (url.pathname.endsWith('/report_categories')) data = categories;
    else if (url.pathname.endsWith('/reports')) {
      if (request.method() === 'POST') {
        writes.push(request.postDataJSON());
        if (failInsert) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Local fixture insert failed' }) });
        data = { ...report, ...request.postDataJSON(), reporter_id: user.id, status: 'pending_review', is_public: false };
      } else data = empty ? [] : [report];
    } else if (url.pathname.endsWith('/my_reports')) data = ownReport ? [{ ...report, reporter_id: user.id }] : [];
    else if (url.pathname.endsWith('/volunteer_opportunities')) data = empty ? [] : [opportunity];
    else if (url.pathname.endsWith('/volunteer_registrations') && request.method() === 'POST') { writes.push({ volunteer: request.postDataJSON() }); data = { id: 'dd111111-1111-4111-8111-111111111111', ...request.postDataJSON() }; }
    else if (url.pathname.endsWith('/user')) data = user;
    else if (url.pathname.endsWith('/token')) data = session;
    else if (url.pathname.endsWith('/platform_statistics')) data = [];
    else if (url.pathname.endsWith('/join_volunteer_opportunity')) {
      writes.push({ join: request.postDataJSON() });
      if (failJoin) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Volunteer capacity reached' }) });
      data = null;
    }
    else if (url.pathname.includes('/functions/')) data = { skipped: true, reason: 'not_configured' };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.leaflet-map').waitFor();
  await page.locator('.report-panel .report-card, .report-list .empty-state').first().waitFor({ state: 'attached' });
  return { page, context, errors, writes, setFailInsert: value => { failInsert = value; }, setFailJoin: value => { failJoin = value; } };
}
async function noOverflow(page) {
  const overflowing = await page.evaluate(() => ({ width: innerWidth, actual: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(el => { const rect = el.getBoundingClientRect(); return rect.width && (rect.right > innerWidth + 1 || rect.left < -1) && getComputedStyle(el).position !== 'absolute' && !el.closest('.leaflet-map'); }).slice(0, 12).map(el => el.className) }));
  assert.ok(overflowing.actual <= overflowing.width + 1, JSON.stringify(overflowing));
}
try {
  for (const width of process.argv.includes('--flows-only') ? [] : [320, 360, 375, 390, 414, 430, 768, 820, 1024, 1180, 1280, 1440, 1920]) {
    const { page, context, errors } = await createPage(width, width < 768 ? 844 : 1000);
    await noOverflow(page);
    const map = await page.locator('.map-stage').boundingBox();
    assert.ok(map.width >= (width < 768 ? width - 30 : width * .45), 'Map must dominate the available space');
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].some(tile => tile.complete && tile.naturalWidth > 0), null, { timeout: 6000 }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results.local/redesign/home-${width}.png`, fullPage: true });
    if (width <= 620) {
      assert.equal(await page.locator('.mobile-bottom-nav > *').count(), 5);
      await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Reports', exact: true }).click();
    } else await page.locator('.desktop-navigation').getByRole('button', { name: 'Reports', exact: true }).click();
    await page.getByRole('button', { name: 'Nearby', exact: true }).click();
    await page.getByText(/Within 10 km/).waitFor();
    await page.getByRole('button', { name: 'Recent', exact: true }).first().click();
    await page.locator('.report-card').first().click();
    await page.getByRole('dialog', { name: 'Report details', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.goBack();
    await page.locator('.dashboard-heading').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Expand map', exact: true }).click();
    await page.getByRole('button', { name: 'Recentre on Eastern Samar' }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Close full map', exact: true }).click();
    await page.getByRole('button', { name: 'Open profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome, neighbor.' }).waitFor();
    assert.equal(await page.getByText('Operations command', { exact: true }).count(), 0);
    await noOverflow(page);
    await page.locator('.brand').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.deepEqual(errors, []);
    results.push({ width, passed: true });
    console.log(`PASS responsive ${width}px`);
    await context.close();
  }
  for (const theme of ['light', 'dark']) {
    const { page, context, errors, writes, setFailInsert } = await createPage(390, 844, { signedIn: true, theme });
    await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Submit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Report a Concern', exact: true });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Next', exact: false }).click();
    assert.equal(await dialog.locator('[aria-current="step"]').innerText(), '1\nDetails');
    await dialog.getByRole('textbox', { name: 'Concern title' }).fill('Local QA fixture report');
    await dialog.getByRole('textbox', { name: 'Describe the concern' }).fill('This is a browser-only fixture description for the reporting flow.');
    await dialog.getByRole('button', { name: 'Next', exact: false }).click();
    await dialog.getByRole('combobox', { name: 'Municipality / city' }).selectOption('Borongan City');
    await dialog.getByRole('textbox', { name: /Barangay/ }).fill('Punta Maria');
    await dialog.getByRole('button', { name: 'Choose point', exact: true }).click();
    await page.locator('.leaflet-map').click({ position: { x: 180, y: 180 } });
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /Map point selected/);
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'Returning from map picking must keep the form scroll lock');
    await dialog.getByRole('button', { name: 'Next', exact: false }).click();
    await page.getByRole('heading', { name: 'Review your report', exact: true }).waitFor();
    await page.screenshot({ path: `test-results.local/redesign/report-review-${theme}.png` });
    setFailInsert(true);
    await dialog.getByRole('button', { name: 'Submit report', exact: true }).click();
    await dialog.locator('[role="alert"]').waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Report submitted!' }).count(), 0);
    setFailInsert(false);
    await dialog.getByRole('button', { name: 'Submit report', exact: true }).dblclick();
    await page.getByRole('heading', { name: 'Report submitted!' }).waitFor();
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'Confirmation retains the modal scroll lock');
    assert.equal(writes.length, 2, 'One failed attempt and one successful insert; double-click must not duplicate');
    assert.equal(writes[1].title, 'Local QA fixture report');
    await page.getByRole('button', { name: 'View My Reports', exact: true }).click();
    assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Closing the final dialog releases the page');
    await noOverflow(page);
    assert.deepEqual(errors, []);
    await context.close();
    results.push({ flow: 'submission', theme, passed: true });
    console.log(`PASS submission ${theme}`);
  }
  for (const signedIn of [false, true]) {
    const { page, context, errors, writes, setFailJoin } = await createPage(390, 844, { signedIn });
    await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Volunteer', exact: true }).click();
    await page.getByRole('heading', { name: opportunity.title, exact: true }).waitFor();
    await page.locator('.volunteer-opportunity').getByRole('button', { name: 'Join', exact: true }).click();
    if (!signedIn) {
      await page.getByRole('dialog').getByText('You need an account to join this activity.').waitFor();
      assert.equal(writes.length, 0);
      await page.keyboard.press('Escape');
    } else {
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('checkbox').check();
      setFailJoin(true);
      await dialog.getByRole('button', { name: 'Confirm & Join', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('heading', { name: "You're in!", exact: true }).count(), 0);
      setFailJoin(false);
      await dialog.getByRole('button', { name: 'Confirm & Join', exact: true }).dblclick();
      await page.getByRole('heading', { name: "You're in!", exact: true }).waitFor();
      assert.equal(writes.filter(value => value.join).length, 2);
      await page.getByRole('button', { name: 'View My Volunteer Activities', exact: true }).click();
      await page.getByRole('heading', { name: 'My Activities', exact: true }).waitFor();
    }
    await noOverflow(page);
    await page.screenshot({ path: `test-results.local/redesign/volunteer-${signedIn ? 'resident' : 'guest'}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
    results.push({ flow: 'volunteer', signedIn, passed: true });
    console.log(`PASS volunteer ${signedIn ? 'resident' : 'guest'}`);
  }
  const staff = await createPage(820, 1000, { signedIn: true, staff: true });
  await staff.page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await staff.page.getByRole('link', { name: 'Operations command', exact: true }).waitFor();
  await staff.page.getByRole('button', { name: 'Staff moderation', exact: true }).click();
  await staff.page.getByRole('heading', { name: 'Moderation queue', exact: true }).waitFor();
  assert.deepEqual(staff.errors, []);
  await staff.context.close();
  results.push({ flow: 'staff navigation', passed: true });
  const denied = await createPage(390, 844);
  await denied.context.clearPermissions();
  await denied.page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Reports', exact: true }).click();
  await denied.page.getByRole('button', { name: 'Nearby', exact: true }).click();
  await denied.page.getByRole('alert').filter({ hasText: 'Location could not be obtained' }).waitFor();
  assert.equal(await denied.page.getByText(/Within 10 km/).count(), 0);
  await denied.context.close();
  results.push({ flow: 'denied location', passed: true });
  const email = await createPage(390, 844, { signedIn: true, ownReport: true });
  await email.page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await email.page.goto(new URL(`#submission=${report.id}`, base).href);
  await email.page.getByRole('dialog', { name: 'Report details', exact: true }).waitFor();
  assert.equal(await email.page.locator('.app-shell').getAttribute('data-destination'), 'submissions');
  await email.page.keyboard.press('Escape');
  await email.page.goto(new URL(`#volunteer=${opportunity.id}`, base).href);
  await email.page.getByRole('dialog').getByRole('heading', { name: opportunity.title, exact: true, level: 2 }).waitFor();
  assert.equal(await email.page.locator('.app-shell').getAttribute('data-destination'), 'volunteers');
  assert.deepEqual(email.errors, []);
  await email.context.close();
  results.push({ flow: 'email deep links', passed: true });
  console.log('PASS report and volunteer email deep links');
  await writeFile(`test-results.local/redesign/${process.argv.includes('--flows-only') ? 'flow-results' : 'results'}.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }

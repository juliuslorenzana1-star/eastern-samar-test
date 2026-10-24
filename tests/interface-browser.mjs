// Local fixtures only; no real sign-in, role changes, reports or writes.
import { chromium } from 'playwright-core';
import { loadEnv } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const env = loadEnv('development', fileURLToPath(new URL('../', import.meta.url)), 'VITE_');
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const base = process.env.UI_TEST_URL || 'http://localhost:5178/';
const output = new URL('../test-results.local/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const id = 'aa111111-1111-4111-8111-111111111111';
const user = { id, email: 'interface-qa@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: { provider: 'email' } };
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp })).toString('base64url')}.local-only-fixture`;
const session = { user, access_token: token, refresh_token: 'local-only-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600 };
const reports = ['verified', 'in_progress', 'pending_review'].map((status, index) => ({
  id: `bb111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`, reporter_id: id,
  title: ['QA fixture: Coastal litter concern', 'QA fixture: Drainage access', 'QA fixture: Road inspection request'][index],
  description: 'Local browser test fixture. This is not a real community report. It exists only inside the intercepted test response and is never saved to a live database.',
  category_slug: index === 0 ? 'environment' : 'infrastructure', municipality: index === 0 ? 'Borongan City' : 'Guiuan', barangay: null,
  latitude: index === 0 ? 11.60806 : 11.03088 + index * .005, longitude: index === 0 ? 125.43194 : 125.72342,
  priority: 'normal', status, is_public: status !== 'pending_review', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}));
const categories = [{ slug: 'environment', name: 'Environment', active: true }, { slug: 'infrastructure', name: 'Infrastructure', active: true }];
const results = [];
async function pageFor(width, height, theme, staff = false, empty = false) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: width < 900, hasTouch: width < 900 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ storageKey, session, theme, staff }) => {
    localStorage.setItem('escam.theme-mode', theme);
    sessionStorage.setItem('escam.intro-seen.v1', '1');
    if (staff) localStorage.setItem(storageKey, JSON.stringify(session));
  }, { storageKey, session, theme, staff });
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://*.supabase.co/**', async (route) => {
    const url = new URL(route.request().url());
    let data = [];
    if (url.pathname.endsWith('/profiles')) {
      const profile = { id, display_name: 'Local QA staff', role: staff ? 'admin' : 'resident' };
      data = url.searchParams.has('id') ? profile : [profile];
    } else if (url.pathname.endsWith('/reports')) data = empty ? [] : reports;
    else if (url.pathname.endsWith('/report_categories')) data = categories;
    else if (url.pathname.endsWith('/user')) data = user;
    else if (url.pathname.endsWith('/token')) data = session;
    if (route.request().method() !== 'GET') assert.ok(url.pathname.includes('/rpc/'), 'UI QA must not issue mutating account or record requests');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return { page, errors };
}
const noOverflow = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && innerWidth <= (visualViewport?.width ?? innerWidth) + 1), 'Page must not scroll horizontally or expand the mobile viewport');
try {
  for (const [width, height, theme] of [[1440, 1000, 'light'], [1440, 1000, 'dark'], [390, 844, 'dark'], [320, 640, 'light'], [768, 1024, 'light'], [844, 390, 'dark']]) {
    const { page, errors } = await pageFor(width, height, theme);
    const phone = width <= 620 || width <= 900 && height <= 480;
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.report-card').first().waitFor({ state: 'attached' });
    assert.equal(await page.locator('.report-card').count(), 2, 'Unpublished report must stay off public map/list');
    assert.equal(await page.locator('.pulse-tile').count(), 3);
    assert.equal(await page.locator('.legend-items').count(), 0);
    assert.equal(await page.locator('.community-more').count(), 0, 'Navigation must not have the old More dropdown');
    if (!phone) {
      await page.getByRole('navigation', { name: 'Community platform' }).getByRole('button', { name: 'Impact', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Impact', exact: true }).getAttribute('aria-current'), 'page');
      await page.getByRole('button', { name: 'Explore map', exact: true }).click();
    }
    await noOverflow(page);
    await page.screenshot({ path: fileURLToPath(new URL(`community-ui-${width}-${height}-${theme}.png`, output)), animations: 'disabled', fullPage: true });
    if (phone) await page.locator('.mobile-bottom-nav').getByRole('button', { name: 'Reports', exact: true }).click();
    else if (width <= 900) await page.getByRole('button', { name: 'Community reports', exact: true }).click();
    await page.locator('.report-filter-disclosure > summary').click();
    await page.getByRole('combobox', { name: 'Filter by category', exact: true }).selectOption('environment');
    await page.waitForFunction(() => document.querySelectorAll('.report-card').length === 1);
    await page.locator('.report-card').first().click();
    await page.getByRole('heading', { name: reports[0].title, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close details', exact: true }).click();
    await page.getByRole('button', { name: 'More community insights', exact: true }).click();
    assert.equal(await page.locator('.pulse-tile').count(), 6);
    await noOverflow(page);
    assert.deepEqual(errors, []);
    console.log(`PASS community ${width}x${height} ${theme}`);
    results.push({ view: 'community', width, height, theme, passed: true });
    await page.close();
  }
  for (const [width, height] of [[1440, 1000], [1024, 768], [390, 844], [320, 640], [844, 390]]) {
    const { page, errors } = await pageFor(width, height, 'dark', true);
    const phone = width <= 760;
    await page.goto(new URL('operations/', base).href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Focus on what’s next.', exact: true }).waitFor();
    await page.locator('.ops-report-index > button').first().waitFor();
    assert.equal(await page.locator('.ops-metrics > div').count(), 3);
    assert.equal(await page.locator('.ops-feed').isVisible(), false);
    await noOverflow(page);
    await page.screenshot({ path: fileURLToPath(new URL(`operations-ui-${width}-${height}.png`, output)), animations: 'disabled', fullPage: true });
    await page.getByRole('button', { name: 'More indicators', exact: true }).click();
    assert.equal(await page.locator('.ops-metrics > div').count(), 6);
    await page.getByRole('button', { name: 'Fewer indicators', exact: true }).click();
    await page.locator('.ops-heading').getByRole('button', { name: 'Activity', exact: true }).click();
    assert.ok(await page.locator('.ops-feed').isVisible());
    await page.getByRole('button', { name: 'Close operations feed', exact: true }).click();
    if (phone) {
      await page.getByRole('navigation', { name: 'Mobile operations navigation' }).getByRole('button', { name: 'More', exact: true }).click();
      await page.getByRole('dialog', { name: 'Operations navigation menu', exact: true }).waitFor();
    }
    await page.getByRole('navigation', { name: 'Operations navigation', exact: true }).getByRole('button', { name: 'Review queue', exact: true }).click();
    await page.getByRole('heading', { name: 'Review queue', exact: true }).waitFor();
    await noOverflow(page);
    assert.deepEqual(errors, []);
    console.log(`PASS operations ${width}x${height}`);
    results.push({ view: 'operations', width, height, passed: true });
    await page.close();
  }
  // Staff destinations are direct links too, including on narrower tablets.
  const staffNavigation = await pageFor(768, 1024, 'dark', true);
  await staffNavigation.page.goto(base, { waitUntil: 'domcontentloaded' });
  const platformNav = staffNavigation.page.getByRole('navigation', { name: 'Community platform' });
  await platformNav.getByRole('link', { name: 'Operations', exact: true }).waitFor();
  await platformNav.getByRole('button', { name: 'Administration', exact: true }).waitFor();
  await noOverflow(staffNavigation.page);
  assert.deepEqual(staffNavigation.errors, []);
  await staffNavigation.page.close();
  for (const staff of [false, true]) {
    const { page, errors } = await pageFor(390, 844, 'dark', staff, true);
    await page.goto(staff ? new URL('operations/', base).href : base, { waitUntil: 'domcontentloaded' });
    if (staff) {
      await page.getByText('No reports in this view', { exact: true }).waitFor();
      assert.deepEqual(await page.locator('.ops-metrics strong').allTextContents(), ['0', '0', '0']);
    } else {
      await page.locator('.report-list .empty-state strong').filter({ hasText: 'No reports yet' }).waitFor({ state: 'attached' });
      assert.equal(await page.locator('.report-card').count(), 0);
    }
    await noOverflow(page);
    assert.deepEqual(errors, []);
    results.push({ view: staff ? 'operations-empty' : 'community-empty', width: 390, passed: true });
    console.log(`PASS ${staff ? 'operations' : 'community'} empty state`);
    await page.close();
  }
  // Signed-out operations must still require authentication.
  const { page, errors } = await pageFor(390, 844, 'light');
  await page.goto(new URL('operations/', base).href, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in to operations', exact: true }).waitFor();
  assert.equal(await page.locator('.ops-metrics').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
  await writeFile(new URL('interface-results.json', output), JSON.stringify(results, null, 2));
} finally { await browser.close(); }

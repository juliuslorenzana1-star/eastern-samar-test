// Local signup-response fixtures only. Every Supabase request is intercepted;
// this test never creates real accounts, sends emails, or writes live records.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { loadEnv } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WELCOME_VERSION, welcomeStorageKey } from '../src/lib/onboarding.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = loadEnv('development', root, 'VITE_');
if (!env.VITE_SUPABASE_URL) throw Error('Local Supabase configuration is required, but no live requests will be sent.');
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const baseURL = process.env.ONBOARDING_TEST_URL || 'http://localhost:5178/';
const output = new URL('../test-results.local/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const results = [];
const makeUser = (number, marked = true) => ({
  id: `ab000000-0000-4000-8000-${String(number).padStart(12, '0')}`, aud: 'authenticated', role: 'authenticated',
  email: 'welcome-qa@example.invalid', identities: [{ provider: 'email' }], created_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { display_name: 'Estehanon', ...(marked ? { smart_este_welcome_version: WELCOME_VERSION } : {}) },
});
const makeSession = (user) => {
  const expires_at = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: expires_at })).toString('base64url');
  return { user, access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.local-test-signature`, refresh_token: 'local-qa-refresh-only', token_type: 'bearer', expires_at, expires_in: 3600 };
};
async function openPage({ width = 390, height = 844, theme = 'dark', user, signup = 'confirmation', restore = false, completed = false, reducedMotion = 'reduce' }) {
  const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, reducedMotion });
  const errors = [], writes = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // External typography is unrelated to signup and must not stall local QA.
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript(({ theme, storageKey, session, completionKey, completed }) => {
    localStorage.setItem('escam.theme-mode', theme);
    sessionStorage.setItem('escam.intro-seen.v1', '1');
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
    if (completed) localStorage.setItem(completionKey, 'done');
  }, { theme, storageKey, session: restore ? makeSession(user) : null, completionKey: welcomeStorageKey(user.id), completed });
  await page.route('https://*.supabase.co/**', async (route) => {
    const request = route.request(), url = new URL(request.url());
    let body = [];
    if (url.pathname.endsWith('/signup')) {
      writes.push('intercepted-signup');
      const payload = request.postDataJSON();
      assert.equal(payload.data.smart_este_welcome_version, WELCOME_VERSION);
      if (signup === 'error') return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ code: 'weak_password', msg: 'Fixture signup failure' }) });
      body = signup === 'session' ? makeSession(user) : signup === 'existing' ? { ...user, identities: [] } : user;
    } else if (url.pathname.endsWith('/user')) body = user;
    else if (url.pathname.endsWith('/profiles')) body = { id: user.id, display_name: 'Estehanon', role: 'resident', show_on_leaderboard: false };
    else if (url.pathname.endsWith('/token')) body = makeSession(user);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  return { page, errors, writes };
}
async function signUp(page) {
  await page.locator('.topbar').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.locator('.auth-modal input[autocomplete="name"]').fill('Estehanon');
  await page.locator('.auth-modal input[type="email"]').fill('welcome-qa@example.invalid');
  await page.locator('.auth-modal input[type="password"]').fill('LocalFixtureOnly123!');
  await page.locator('.auth-modal button[type="submit"]').click();
}
try {
  let number = 1;
  for (const [width, height, theme] of [[1440, 1000, 'light'], [390, 844, 'dark'], [320, 640, 'light'], [844, 390, 'dark'], [768, 1024, 'dark']]) {
    const user = makeUser(number++);
    const { page, errors, writes } = await openPage({ width, height, theme, user, reducedMotion: width === 1440 ? 'no-preference' : 'reduce' });
    await signUp(page);
    await page.locator('.smart-tour-dialog').waitFor();
    assert.match(await page.locator('#smart-tour-title').innerText(), /SMART ESTE/);
    assert.ok(await page.locator('.smart-confirm-note').isVisible());
    assert.ok(await page.locator('#root').evaluate((node) => node.inert));
    await page.getByRole('button', { name: 'Skip tour', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.includes('Show me around')), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.includes('Skip tour')), true);
    if (width !== 1440) assert.equal(await page.locator('.smart-welcome-art > img').evaluate((node) => getComputedStyle(node).animationName), 'none');
    await page.locator('.smart-tour-dialog').screenshot({ path: fileURLToPath(new URL(`smart-este-welcome-${width}.png`, output)), animations: 'disabled' });
    await page.getByRole('button', { name: 'Show me around', exact: true }).click();
    await page.getByRole('button', { name: 'Explore the map', exact: true }).click();
    await page.getByRole('region', { name: 'SMART ESTE tutorial in progress' }).waitFor();
    assert.equal(await page.locator('.smart-tour-dialog').count(), 0);
    assert.equal(await page.locator('#root').evaluate((node) => node.inert), false);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), welcomeStorageKey(user.id)), null, 'Exploring must not mark the tutorial complete');
    await page.getByRole('button', { name: 'Continue tutorial', exact: true }).click();
    await page.getByRole('heading', { name: 'See your community clearly.', exact: true }).waitFor();
    for (let step = 1; step <= 5; step++) {
      await page.getByRole('button', { name: `Step ${step}:`, exact: false }).waitFor();
      assert.equal(await page.locator('.smart-tour-progress [aria-current="step"]').count(), 1);
      assert.equal(await page.locator('.smart-tour-progress [aria-current="step"]').getAttribute('aria-label'), `Step ${step}: ${['Explore', 'Report', 'Track', 'Volunteer', 'Impact'][step - 1]}`);
      const geometry = await page.locator('.smart-tour-dialog').evaluate((node) => {
        const r = node.getBoundingClientRect();
        return { fits: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1, noOverflow: document.documentElement.scrollWidth <= innerWidth, footerVisible: node.querySelector('footer').getBoundingClientRect().bottom <= innerHeight, focusInside: node.contains(document.activeElement) };
      });
      assert.ok(Object.values(geometry).every(Boolean), JSON.stringify({ width, height, step, geometry }));
      if (step === 2) {
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.locator('.smart-tour-dialog').screenshot({ path: fileURLToPath(new URL(`smart-este-tutorial-${width}.png`, output)), animations: 'disabled' });
      }
      await page.getByRole('button', { name: step === 5 ? 'Start exploring' : 'Next', exact: true }).click();
    }
    await page.locator('.smart-tour-dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), welcomeStorageKey(user.id)), 'done');
    assert.equal(await page.locator('#root').evaluate((node) => node.inert), false);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await page.getByRole('button', { name: 'SMART ESTE tour', exact: true }).click();
    await page.locator('.smart-tour-dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.smart-tour-dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.includes('SMART ESTE tour')), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, ['intercepted-signup']);
    results.push({ width, height, theme, signup: 'email confirmation', allSteps: true, replay: true, fits: true, consoleErrors: 0 });
    console.log(`PASS signup and tour ${width}x${height} ${theme}`);
    await page.close();
  }
  for (const scenario of ['session', 'existing', 'error', 'restored-new', 'restored-completed', 'restored-existing']) {
    const user = makeUser(number++, scenario !== 'restored-existing');
    const { page, errors } = await openPage({ user, signup: scenario, restore: scenario.startsWith('restored-'), completed: scenario === 'restored-completed' });
    if (!scenario.startsWith('restored-')) await signUp(page);
    if (['session', 'restored-new'].includes(scenario)) {
      await page.locator('.smart-tour-dialog').waitFor();
      assert.equal(await page.locator('.smart-confirm-note').count(), 0);
      await page.getByRole('button', { name: 'Skip tour', exact: true }).click();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.leaflet-map').waitFor();
      assert.equal(await page.locator('.smart-tour-dialog').count(), 0, 'Completion must survive reload');
    } else {
      if (scenario === 'error') await page.locator('.auth-modal .form-error').waitFor();
      else if (scenario === 'existing') await page.locator('#auth-dialog-title').filter({ hasText: 'Sign in' }).waitFor();
      else await page.locator('.leaflet-map').waitFor();
      assert.equal(await page.locator('.smart-tour-dialog').count(), 0);
    }
    assert.deepEqual(errors, []);
    results.push({ scenario, passed: true });
    console.log(`PASS ${scenario}`);
    await page.close();
  }
  await writeFile(new URL('smart-este-results.json', output), JSON.stringify(results, null, 2));
} finally { await browser.close(); }

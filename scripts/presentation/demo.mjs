import { build, preview } from 'vite';
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { DEMO_ORIGIN, DEMO_KEY, createDemoState, installDemoTransport, installDemoPresentation } from './fixtures.mjs';

export async function startDemo({ headless = false, recordVideo } = {}) {
  // Override .env values before Vite resolves them. Production keys/URLs are never built here.
  Object.assign(process.env, { VITE_SUPABASE_URL: DEMO_ORIGIN, VITE_SUPABASE_PUBLISHABLE_KEY: DEMO_KEY, VITE_SUPABASE_ANON_KEY: '', VITE_ENABLE_AI_SCREENING: 'false', VITE_ENABLE_EMAIL_NOTIFICATIONS: 'false' });
  await build({ mode: 'demo', build: { outDir: 'demo-dist.local', emptyOutDir: true }, logLevel: 'warn' });
  const server = await preview({ mode: 'demo', build: { outDir: 'demo-dist.local' }, preview: { host: '127.0.0.1', port: 5184, strictPort: true }, logLevel: 'warn' });
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce', serviceWorkers: 'block', ...(recordVideo ? { recordVideo: { dir: recordVideo, size: { width: 1920, height: 1080 } } } : {}) });
  const origin = 'http://127.0.0.1:5184'; const state = createDemoState();
  await installDemoTransport(context, state, origin); await installDemoPresentation(context);
  const page = await context.newPage(); await page.goto(origin); await page.locator('.leaflet-map').waitFor();
  return { page, state, context, browser, origin, async close() { await context.close(); await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); } };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const demo = await startDemo();
  console.log('Isolated rehearsal opened in Edge. Use this browser window; other browsers do not have its request interception. Close the window or press Ctrl+C to stop. No state is saved to Supabase.');
  let closing = false; const close = async () => { if (closing) return; closing = true; await demo.close(); };
  process.on('SIGINT', async () => { await close(); process.exit(0); });
  demo.browser.on('disconnected', async () => { if (!closing) { closing = true; process.exit(0); } });
}

// Capture the real, read-only public interface. No accounts or records are changed.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('test-results.local/redesign', { recursive: true });
try {
  for (const width of [390, 820, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('escam.theme-mode', 'dark'));
    await page.goto(process.env.UI_TEST_URL || 'http://localhost:5178/', { waitUntil: 'domcontentloaded' });
    await page.locator('.leaflet-map').waitFor();
    await page.waitForFunction(() => document.querySelector('.report-list .report-card') || document.querySelector('.report-list .empty-state strong')?.textContent === 'No reports yet');
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].some(tile => tile.complete && tile.naturalWidth > 0), null, { timeout: 6000 }).catch(() => {});
    await page.evaluate(async () => { window.scrollTo({ top: 0, behavior: 'instant' }); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    console.log(width, await page.evaluate(() => ({ scrollY, heading: document.querySelector('.heading-copy').getBoundingClientRect().toJSON(), header: document.querySelector('.topbar').getBoundingClientRect().toJSON(), styles: getComputedStyle(document.querySelector('.heading-copy')).transform })));
    await page.screenshot({ path: `test-results.local/redesign/public-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.close();
  }
} finally { await browser.close(); }

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hasCoordinates } from '../src/lib/place.js';

// Inject the database transport while executing the real report module.
const source = await readFile(new URL('../src/lib/reports.js', import.meta.url), 'utf8');
const insertions = [];
globalThis.reportTestTransport = {
  rpc: async () => ({ error: { code: 'PGRST202' } }),
  functions: { invoke: async () => ({ data: { skipped: true, reason: 'email_not_configured' } }) },
  from: (table) => {
    assert.equal(table, 'reports');
    return { insert: (values) => {
      insertions.push(values);
      return { select: () => ({ single: async () => ({ data: { id: 'saved-report', ...values, status: 'pending_review', is_public: false }, error: null }) }) };
    } };
  },
};
const injected = source.replace("import { supabase } from './supabase.js';", 'const supabase = globalThis.reportTestTransport;');
const reports = await import('data:text/javascript;base64,' + Buffer.from(injected).toString('base64'));

test('missing ownership RPC fails closed without a staff-wide table query', async () => {
  await assert.rejects(reports.fetchMyReports('signed-in-staff'), /my_reports/);
  assert.equal(insertions.length, 0);
});
test('saved reports remain successful when email and screening are unavailable', async () => {
  const result = await reports.createReport({ title: 'Coastal concern', description: 'A community concern needing review.', category: 'environment', municipality: 'Guiuan', barangay: '', priority: 'normal' }, 'resident');
  assert.equal(result.report.id, 'saved-report');
  assert.equal(insertions.length, 1);
  assert.match(result.warning, /Report saved/);
  assert.match(result.warning, /pending human review/);
  assert.equal(result.report.is_public, false);
});
test('evidence validation rejects oversize and spoofed image content', async () => {
  await assert.rejects(reports.validateEvidenceFile({ type: 'image/jpeg', size: 6 * 1024 * 1024 }), /5 MB/);
  const spoofed = new Blob(['not a PNG'], { type: 'image/png' });
  await assert.rejects(reports.validateEvidenceFile(spoofed), /does not match/);
  const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], { type: 'image/png' });
  assert.deepEqual(await reports.validateEvidenceFile(png), { extension: 'png' });
});
test('optional coordinates do not become phantom points at zero', () => {
  assert.equal(hasCoordinates({ latitude: null, longitude: null }), false);
  assert.equal(hasCoordinates({ latitude: '', longitude: '' }), false);
  assert.equal(hasCoordinates({ latitude: 11.6, longitude: 125.4 }), true);
});

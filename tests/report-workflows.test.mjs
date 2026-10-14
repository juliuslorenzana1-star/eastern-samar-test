import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hasCoordinates } from '../src/lib/place.js';

// Inject the database transport while executing the real report module.
const source = await readFile(new URL('../src/lib/reports.js', import.meta.url), 'utf8');
const insertions = [];
const ownerQueries = [];
let lookupError = { code: '42501' };
let rpcError = { code: 'PGRST202' };
let reviewColumnsMissing = false;
globalThis.reportTestTransport = {
  rpc: async () => ({ error: rpcError }),
  functions: { invoke: async () => ({ data: { skipped: true, reason: 'email_not_configured' } }) },
  from: (table) => {
    assert.equal(table, 'reports');
    return { select: (columns) => ({ eq: (column, userId) => {
      ownerQueries.push({ column, userId, columns });
      return { order: () => ({ limit: async () => {
        if (reviewColumnsMissing && columns.includes('decision_note')) return { error: { code: '42703' } };
        return { error: lookupError, data: lookupError ? null : [{ id: 'own-published-report', status: 'approved', is_public: true }] };
      } }) };
    } }), insert: (values) => {
      insertions.push(values);
      return { select: () => ({ single: async () => ({ data: { id: 'saved-report', ...values, status: 'pending_review', is_public: false }, error: null }) }) };
    } };
  },
};
const injected = source.replace("import { supabase } from './supabase.js';", 'const supabase = globalThis.reportTestTransport;');
const reports = await import('data:text/javascript;base64,' + Buffer.from(injected).toString('base64'));

test('missing ownership RPC and denied owner lookup fail closed', async () => {
  await assert.rejects(reports.fetchMyReports('signed-in-staff'), /my_reports/);
  assert.equal(ownerQueries.at(-1).column, 'reporter_id');
  assert.equal(ownerQueries.at(-1).userId, 'signed-in-staff');
  assert.equal(insertions.length, 0);
});
test('legacy databases load own reports with an explicit ownership filter, including published rows', async () => {
  lookupError = null;
  const result = await reports.fetchMyReports('resident');
  assert.equal(result[0].id, 'own-published-report');
  assert.equal(ownerQueries.at(-1).column, 'reporter_id');
  assert.equal(ownerQueries.at(-1).userId, 'resident');
});
test('legacy databases without review columns retain ownership filtering', async () => {
  reviewColumnsMissing = true;
  const result = await reports.fetchMyReports('staff');
  assert.equal(result.length, 1);
  assert.equal(ownerQueries.at(-1).userId, 'staff');
  assert.equal(ownerQueries.at(-1).columns.includes('decision_note'), false);
  reviewColumnsMissing = false;
});
test('network errors do not fall back to a different data source', async () => {
  rpcError = { message: 'Failed to fetch' };
  const before = ownerQueries.length;
  await assert.rejects(reports.fetchMyReports('resident'), /connection/);
  assert.equal(ownerQueries.length, before);
  rpcError = { code: 'PGRST202' };
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

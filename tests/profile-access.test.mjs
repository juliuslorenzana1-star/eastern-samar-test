import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Execute the real report module with an isolated database transport per test.
const source = await readFile(new URL('../src/lib/reports.js', import.meta.url), 'utf8');
let moduleNumber = 0;

async function loadReports(responses) {
  const calls = [];
  const transportKey = `profileAccessTransport${moduleNumber++}`;
  globalThis[transportKey] = {
    from: (table) => ({ select: (columns) => ({ eq: (column, userId) => ({
      single: async () => {
        calls.push({ table, columns, column, userId });
        assert.ok(responses.length, 'Unexpected profile query');
        return responses.shift();
      },
    }) }) }),
  };
  const injected = source.replace(
    "import { supabase } from './supabase.js';",
    `const supabase = globalThis[${JSON.stringify(transportKey)}];`,
  );
  try {
    const reports = await import('data:text/javascript;base64,' + Buffer.from(injected).toString('base64'));
    return { reports, calls };
  } finally {
    delete globalThis[transportKey];
  }
}

for (const role of ['admin', 'moderator', 'resident']) {
  test(`profile lookup preserves the database ${role} role`, async () => {
    const profile = { id: 'signed-in-user', display_name: 'Resident', role, show_on_leaderboard: false };
    const { reports, calls } = await loadReports([{ data: profile, error: null }]);
    assert.deepEqual(await reports.fetchProfile(profile.id), profile);
    assert.deepEqual(calls, [{
      table: 'profiles', columns: 'id,display_name,role,show_on_leaderboard',
      column: 'id', userId: profile.id,
    }]);
  });
}

for (const code of ['42703', 'PGRST204']) {
  test(`missing preference column (${code}) retries the same owner's core profile`, async () => {
    const profile = { id: 'staff-user', display_name: 'Staff', role: 'moderator' };
    const { reports, calls } = await loadReports([
      { data: null, error: { code, message: 'show_on_leaderboard does not exist' } },
      { data: profile, error: null },
    ]);
    const result = await reports.fetchProfile(profile.id);
    assert.deepEqual(result, profile);
    assert.equal(Object.hasOwn(result, 'show_on_leaderboard'), false);
    assert.deepEqual(calls, [
      { table: 'profiles', columns: 'id,display_name,role,show_on_leaderboard', column: 'id', userId: profile.id },
      { table: 'profiles', columns: 'id,display_name,role', column: 'id', userId: profile.id },
    ]);
  });
}

for (const error of [
  { code: '42501', message: 'Permission denied' },
  { code: 'PGRST116', message: 'No profile row' },
  { code: 'PGRST202', message: 'Function unavailable' },
  { message: 'Failed to fetch' },
]) {
  test(`profile error ${error.code ?? 'network'} fails without retrying`, async () => {
    const { reports, calls } = await loadReports([{ data: null, error }]);
    await assert.rejects(reports.fetchProfile('resident-user'), (actual) => actual === error);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].column, 'id');
    assert.equal(calls[0].userId, 'resident-user');
  });
}

test('failed compatibility lookup also fails closed', async () => {
  const error = { code: '42501', message: 'Permission denied' };
  const { reports, calls } = await loadReports([
    { data: null, error: { code: '42703' } },
    { data: null, error },
  ]);
  await assert.rejects(reports.fetchProfile('resident-user'), (actual) => actual === error);
  assert.equal(calls.length, 2);
});

test('missing user ID skips profile access', async () => {
  const { reports, calls } = await loadReports([]);
  for (const userId of ['', null, undefined]) {
    assert.equal(await reports.fetchProfile(userId), null);
  }
  assert.equal(calls.length, 0);
});

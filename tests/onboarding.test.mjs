import test from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME_VERSION, finishWelcome, hasFinishedWelcome, needsWelcome, welcomeStorageKey } from '../src/lib/onboarding.js';

const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const account = (id) => ({ id, user_metadata: { smart_este_welcome_version: WELCOME_VERSION } });

test('only new signups marked for SMART ESTE automatically enter the tour', () => {
  const local = storage();
  assert.equal(needsWelcome(null, local), false);
  assert.equal(needsWelcome({ id: 'existing-resident', user_metadata: {} }, local), false);
  assert.equal(needsWelcome(account('new-resident'), local), true);
});

test('completion is remembered per account without affecting another account', () => {
  const local = storage();
  finishWelcome('completed-resident', local);
  assert.equal(local.getItem(welcomeStorageKey('completed-resident')), 'done');
  assert.equal(needsWelcome(account('completed-resident'), local), false);
  assert.equal(needsWelcome(account('other-resident'), local), true);
});

test('confirmation redirects can read completion saved in a previous page session', () => {
  const local = storage();
  local.setItem(welcomeStorageKey('confirmed-resident'), 'done');
  assert.equal(hasFinishedWelcome('confirmed-resident', local), true);
  assert.equal(needsWelcome(account('confirmed-resident'), local), false);
});

test('blocked browser storage does not break signup or reopen a completed tour during the session', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(needsWelcome(account('private-browser-resident'), blocked), true);
  finishWelcome('private-browser-resident', blocked);
  assert.equal(needsWelcome(account('private-browser-resident'), blocked), false);
  assert.doesNotThrow(() => finishWelcome(null, blocked));
});

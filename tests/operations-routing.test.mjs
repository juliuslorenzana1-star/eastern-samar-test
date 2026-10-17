import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOperationsPath } from '../src/lib/routes.js';

test('local operations entry accepts a trailing slash', () => {
  assert.equal(isOperationsPath('/operations'), true);
  assert.equal(isOperationsPath('/operations/'), true);
  assert.equal(isOperationsPath('/'), false);
});

test('Pages project entry stays scoped to the configured application base', () => {
  const base = '/eastern-samar-test/';
  assert.equal(isOperationsPath('/eastern-samar-test/operations/', base), true);
  assert.equal(isOperationsPath('/eastern-samar-test/operations', base), true);
  assert.equal(isOperationsPath('/eastern-samar-test/', base), false);
  assert.equal(isOperationsPath('/operations', base), false);
  assert.equal(isOperationsPath('/other/operations', base), false);
  assert.equal(isOperationsPath('/eastern-samar-test/operations/extra', base), false);
});

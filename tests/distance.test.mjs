import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm } from '../src/lib/distance.js';

test('nearby distances distinguish Borongan from Guiuan and exclude missing public coordinates', () => {
  const borongan = { latitude: 11.60806, longitude: 125.43194 };
  assert.equal(distanceKm(borongan, borongan), 0);
  assert.ok(distanceKm(borongan, { latitude: 11.615, longitude: 125.43 }) < 1);
  assert.ok(distanceKm(borongan, { latitude: 11.03, longitude: 125.72 }) > 60);
  assert.equal(distanceKm(borongan, { latitude: null, longitude: null }), Infinity);
  assert.equal(distanceKm(borongan, { latitude: 'invalid', longitude: 125.43 }), Infinity);
});

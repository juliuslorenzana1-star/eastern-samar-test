import test from 'node:test';
import assert from 'node:assert/strict';
import { observeMapViewport } from '../src/lib/mapViewport.js';

function setup({ observer = true } = {}) {
  const environment = new EventTarget();
  environment.document = new EventTarget();
  environment.visualViewport = new EventTarget();
  const frames = new Map();
  let id = 0, resize, disconnected = false;
  environment.requestAnimationFrame = (callback) => { frames.set(++id, callback); return id; };
  environment.cancelAnimationFrame = (key) => frames.delete(key);
  if (observer) environment.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  const container = { clientWidth: 0, clientHeight: 0 };
  const calls = [];
  const bounds = [[10, 125], [12, 126]];
  const map = {
    getContainer: () => container,
    invalidateSize: (options) => calls.push(['resize', options]),
    fitBounds: (...args) => calls.push(['fit', ...args]),
  };
  const stop = observeMapViewport(map, bounds, environment);
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback()); };
  return { environment, container, calls, bounds, stop, flush, resize: () => resize(), disconnected: () => disconnected, frames };
}

test('waits for a visible map and fits using its final mobile dimensions', () => {
  const state = setup();
  state.flush();
  assert.equal(state.calls.length, 0);
  Object.assign(state.container, { clientWidth: 374, clientHeight: 523 });
  state.resize();
  state.flush();
  assert.deepEqual(state.calls.map(([kind]) => kind), ['resize', 'fit']);
  assert.deepEqual(state.calls[1][1], state.bounds);
  // Closing login / keyboard changes the container without a window resize.
  state.container.clientHeight = 610;
  state.resize();
  state.resize();
  state.flush();
  assert.deepEqual(state.calls.map(([kind]) => kind), ['resize', 'fit', 'resize']);
  state.stop();
});

test('recovers on keyboard and browser restoration events without resetting map position', () => {
  const state = setup({ observer: false });
  Object.assign(state.container, { clientWidth: 390, clientHeight: 523 });
  state.flush();
  for (const [target, event] of [
    [state.environment.visualViewport, 'resize'],
    [state.environment.document, 'visibilitychange'],
    [state.environment, 'pageshow'],
    [state.environment, 'resize'],
  ]) {
    target.dispatchEvent(new Event(event));
    state.flush();
  }
  assert.equal(state.calls.filter(([kind]) => kind === 'fit').length, 1);
  assert.equal(state.calls.filter(([kind]) => kind === 'resize').length, 5);
  state.stop();
  state.environment.dispatchEvent(new Event('pageshow'));
  assert.equal(state.frames.size, 0);
});

test('unmount cancels pending work and disconnects observers for Strict Mode remounts', () => {
  const state = setup();
  state.stop();
  state.flush();
  state.resize();
  state.flush();
  assert.equal(state.calls.length, 0);
  assert.equal(state.disconnected(), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVINCIAL_EMERGENCIES, MUNICIPAL_HOTLINES } from '../src/data/emergencyHotlines.js';
import {
  getOfflineDrafts,
  saveOfflineDraft,
  removeOfflineDraft,
  clearOfflineDrafts,
  syncOfflineDrafts,
} from '../src/lib/offline-drafts.js';

// Setup mock localStorage
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};
globalThis.window = {
  dispatchEvent: () => true,
};
globalThis.CustomEvent = class CustomEvent {
  constructor(name, options) {
    this.name = name;
    this.detail = options?.detail;
  }
};

test('emergency directory covers Borongan City and all 22 municipalities', () => {
  assert.equal(MUNICIPAL_HOTLINES.length, 23);

  const city = MUNICIPAL_HOTLINES.find((m) => m.isCity);
  assert.ok(city, 'Borongan City should be marked as city');
  assert.equal(city.municipality, 'Borongan City');

  for (const item of MUNICIPAL_HOTLINES) {
    assert.ok(item.municipality, 'Municipality name must exist');
    assert.ok(item.mdrrmo.number, `${item.municipality} must have an MDRRMO number`);
    assert.ok(item.pnp.number, `${item.municipality} must have a PNP number`);
    assert.ok(item.bfp.number, `${item.municipality} must have a BFP number`);
    assert.ok(item.health.number, `${item.municipality} must have a Health/Hospital number`);
  }
});

test('legacy disaster, medical and utility contacts are retained for source review', () => {
  assert.ok(PROVINCIAL_EMERGENCIES.length >= 6);

  const pdrrmo = PROVINCIAL_EMERGENCIES.find((e) => e.id === 'pdrrmo');
  assert.ok(pdrrmo, 'PDRRMO must be present');
  assert.ok(pdrrmo.numbers.length >= 2, 'PDRRMO must have redundant contact numbers');

  const samelco = PROVINCIAL_EMERGENCIES.find((e) => e.id === 'samelco2');
  assert.ok(samelco, 'SAMELCO II power hazard hotline must be present');

  const esph = PROVINCIAL_EMERGENCIES.find((e) => e.id === 'esph');
  assert.ok(esph, 'Provincial Hospital trauma hotline must be present');
});

test('offline drafts management persists, updates, and syncs queue correctly', async () => {
  clearOfflineDrafts();
  assert.equal(getOfflineDrafts().length, 0);

  const saved1 = saveOfflineDraft({
    title: 'Damaged footbridge in Sitio Binaloan',
    category: 'infrastructure',
    municipality: 'Taft',
    description: 'Footbridge timbers broken after river surge',
  });

  assert.ok(saved1.id);
  assert.equal(getOfflineDrafts().length, 1);

  saveOfflineDraft({
    title: 'Fallen coconut tree blocking road',
    category: 'hazard',
    municipality: 'Guiuan',
    description: 'National highway lane blocked near Brgy. Cogon',
  });

  assert.equal(getOfflineDrafts().length, 2);

  // Sync test with a mock submit handler
  const submitted = [];
  const mockSubmit = async (payload) => {
    submitted.push(payload);
    return { ok: true };
  };

  const result = await syncOfflineDrafts(mockSubmit);
  assert.equal(result.synced, 2);
  assert.equal(result.failed, 0);
  assert.equal(submitted.length, 2);
  assert.equal(getOfflineDrafts().length, 0, 'Queue should be empty after successful sync');
  const privateDraft=saveOfflineDraft({title:'Private draft',ownerId:'resident-a'});
  assert.equal(getOfflineDrafts('resident-a').length,1);
  assert.equal(getOfflineDrafts('resident-b').length,0);
  assert.equal(getOfflineDrafts(null).length,0);
  const otherAccount=await syncOfflineDrafts(mockSubmit,'resident-b');
  assert.equal(otherAccount.synced,0);
  removeOfflineDraft(privateDraft.id);
});

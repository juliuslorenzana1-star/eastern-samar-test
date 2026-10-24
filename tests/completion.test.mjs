import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateReport, reportLifecycle, CATEGORY_SLUGS } from '../src/lib/report-validation.js';
import { clusterReports } from '../src/lib/mapClusters.js';
import { monthlyTrends } from '../src/lib/analytics.js';
import { MUNICIPALITIES } from '../src/lib/place.js';
import { assertSafeClientEnv } from '../scripts/client-env.mjs';

const valid={title:'Broken drainage',description:'Blocked drainage needs inspection.',category:'infrastructure',municipality:'Guiuan',barangay:'',priority:'normal'};
test('build environment rejects secret Supabase credentials before bundling',()=>{
  assert.throws(()=>assertSafeClientEnv({VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'}),/Secret credentials/);
  const token='header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';
  assert.throws(()=>assertSafeClientEnv({VITE_SUPABASE_ANON_KEY:token}),/anon role/);
  assert.doesNotThrow(()=>assertSafeClientEnv({VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}));
});
test('all ten report categories validate; malformed submissions fail before transport',()=>{
  for(const category of CATEGORY_SLUGS) assert.equal(validateReport({...valid,category}).category,category);
  for(const invalid of [{title:'   '},{description:'short'},{category:'fake'},{municipality:'Manila'},{location:{lat:0,lng:0}},{priority:'critical'},{incidentAt:'nonsense'}])assert.throws(()=>validateReport({...valid,...invalid}));
});
test('verified report remains open until resolution; legacy approved is not verified',()=>{
  assert.deepEqual(reportLifecycle({status:'verified',verified_at:'2026-10-25'}),{verification:'verified',resolution:'open'});
  assert.deepEqual(reportLifecycle({status:'resolved',verified_at:null}),{verification:'approved',resolution:'resolved'});
  assert.equal(reportLifecycle({status:'approved'}).verification,'approved');
});
test('clusters merge nearby markers and preserve every report exactly once',()=>{
  const reports=[{id:'a',latitude:11.6,longitude:125.4},{id:'b',latitude:11.60001,longitude:125.40001},{id:'c',latitude:11,longitude:125.7}];
  const groups=clusterReports(reports,9);
  assert.equal(groups.length,2);
  assert.deepEqual(groups.flatMap(group=>group.items.map(report=>report.id)).sort(),['a','b','c']);
  assert.equal(clusterReports(reports,17).flatMap(group=>group.items).length,3);
});
test('monthly trend counts separate submission and actual current resolution dates',()=>{
  const periods=monthlyTrends([{created_at:'2026-09-01',status:'resolved',resolved_at:'2026-10-02'},{created_at:'2026-10-01',status:'in_progress',resolved_at:'2026-10-03'}],new Date('2026-10-25T00:00:00Z'));
  assert.equal(periods.length,6);
  assert.equal(periods[4].submitted,1);
  assert.deepEqual(periods[5],{month:'2026-10',submitted:1,resolved:1});
});
test('geography includes exactly the 23 supported LGUs and real polygon coordinates',async()=>{
  const geo=JSON.parse(await readFile(new URL('../src/assets/eastern-samar-municipalities.json',import.meta.url),'utf8'));
  assert.equal(geo.features.length,23);
  assert.deepEqual(geo.features.map(feature=>feature.properties.municipality).sort(),[...MUNICIPALITIES].sort());
  assert.ok(geo.features.every(feature=>['Polygon','MultiPolygon'].includes(feature.geometry.type)));
});

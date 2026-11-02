// Local metadata-only review; never connects to providers or deletes anything.
import { readFileSync } from 'node:fs';
import { planRetention } from '../src/lib/privacy-policy.js';
const input = process.argv[2];
if (!input || !process.argv.includes('--metadata-only')) {
  console.error('Usage: node scripts/retention-preview.mjs metadata.json --metadata-only');
  process.exit(1);
}
const records = JSON.parse(readFileSync(input, 'utf8'));
if (!Array.isArray(records) || records.length > 10000) throw new Error('Provide an array of at most 10,000 metadata records.');
const allowed = new Set(['id', 'category', 'status', 'closedAt', 'hold', 'verifiedDeletionRequestedAt']);
for (const record of records) {
  if (!record || typeof record !== 'object' || Object.keys(record).some(key => !allowed.has(key))) throw new Error('Only retention metadata is accepted. Remove report contents, identities and contact details.');
}
console.log(JSON.stringify({ dryRun: true, plans: records.map(record => planRetention(record)) }, null, 2));

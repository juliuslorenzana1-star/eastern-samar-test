import test from 'node:test';
import assert from 'node:assert/strict';
import { planRetention, privacyPolicy } from '../src/lib/privacy-policy.js';
const now = Date.parse('2026-11-02T00:00:00Z');
const closed = { id: 'fictional', category: 'report', status: 'resolved', closedAt: '2024-11-02T00:00:00Z', hold: false };
test('owner attestation does not claim legal review or authorize destructive execution', () => {
  assert.equal(privacyPolicy.finalReviewApproved, false);
  assert.equal(privacyPolicy.operatorConfirmed, true);
  assert.equal(privacyPolicy.contactDeliveryVerified, true);
  assert.equal(privacyPolicy.contactVerificationSource, 'owner_attestation');
  assert.equal(privacyPolicy.retentionApproved, true);
  assert.equal(planRetention(closed, now).executable, false);
});
test('closure-based anniversaries differ for reports/photos and moderation', () => {
  assert.equal(planRetention(closed, now).action, 'delete_or_anonymize_personal_information');
  assert.equal(planRetention({ ...closed, category: 'photo' }, now).action, 'delete');
  assert.equal(planRetention({ ...closed, category: 'moderation' }, now).dueAt, '2027-11-02T00:00:00.000Z');
  assert.equal(planRetention({ ...closed, category: 'moderation' }, now).action, 'retain_until_review');
});
test('holds, missing closure, open cases and unsupported categories require review', () => {
  for (const patch of [{ hold: true }, { hold: undefined }, { closedAt: null }, { status: 'verified' }, { closedAt: '2027-01-01T00:00:00Z' }, { category: 'backup' }]) {
    assert.equal(planRetention({ ...closed, ...patch }, now).action, 'manual_review');
  }
});
test('account request target requires verification and never uses inactivity', () => {
  assert.equal(planRetention({ id: 'fictional', category: 'account', hold: false }, now).action, 'manual_review');
  const plan = planRetention({ category: 'account', hold: false, verifiedDeletionRequestedAt: '2026-10-01T00:00:00Z' }, now);
  assert.equal(plan.dueAt, '2026-10-31T00:00:00.000Z');
  assert.equal(plan.action, 'review_account_deletion_target');
});
test('calendar retention handles leap day without extending to March', () => {
  const plan = planRetention({ ...closed, closedAt: '2024-02-29T12:00:00Z' }, now);
  assert.equal(plan.dueAt, '2026-02-28T12:00:00.000Z');
});

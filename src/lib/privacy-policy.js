// Owner confirmed operator, inbox delivery and retention on 2 November 2026.
// This records owner attestation, not independent legal review or a deletion job.
export const privacyPolicy = Object.freeze({
  version: '2026-11-02-owner-approved',
  operator: 'Julius Yexel A. Lorenzana',
  operatorConfirmed: true,
  contact: 'juliuslorenzana1@gmail.com',
  contactDeliveryVerified: true,
  contactVerificationSource: 'owner_attestation',
  retentionApproved: true,
  finalReviewApproved: false,
  reportYearsAfterClosure: 2,
  photoYearsAfterClosure: 2,
  moderationYearsAfterClosure: 3,
  accountDeletionTargetDays: 30,
});

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function anniversary(ms, years) {
  const date = new Date(ms);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  // February 29 expires on February 28 in a non-leap anniversary year.
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.getTime();
}

/** Dry-run only. Accept metadata, never report text, contact details or photos.
 * A trusted reviewer must attest holds have been checked. Unknown is not false.
 * updated_at is never a substitute for closure or a verified deletion request.
 */
export function planRetention(record, now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error('A valid review time is required.');
  const base = { id: record.id, category: record.category, policyVersion: privacyPolicy.version, executable: false };
  const review = reason => ({ ...base, action: 'manual_review', reason });
  if (record.hold !== false) return review('Hold clearance is required.');
  let due;
  let action;
  if (['report', 'photo', 'moderation'].includes(record.category)) {
    if (!['resolved', 'closed', 'rejected'].includes(record.status)) return review('The case is not closed.');
    const closed = timestamp(record.closedAt);
    if (closed === null || closed > now) return review('A valid authoritative closure timestamp is required.');
    const years = record.category === 'moderation' ? privacyPolicy.moderationYearsAfterClosure : privacyPolicy.reportYearsAfterClosure;
    due = anniversary(closed, years);
    action = record.category === 'report' ? 'delete_or_anonymize_personal_information' : 'delete';
  } else if (record.category === 'account') {
    const requested = timestamp(record.verifiedDeletionRequestedAt);
    if (requested === null || requested > now) return review('A verified account deletion request is required.');
    due = requested + privacyPolicy.accountDeletionTargetDays * 86400000;
    action = 'review_account_deletion_target';
  } else return review('No approved rule exists for this category.');
  return { ...base, action: due <= now ? action : 'retain_until_review', dueAt: new Date(due).toISOString(), reason: 'Proposed schedule only; final review and dependency checks required.' };
}

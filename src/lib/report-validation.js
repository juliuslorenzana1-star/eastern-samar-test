import { MUNICIPALITIES, PROVINCE } from './place.js';

export const CATEGORY_SLUGS = ['disaster-emergency', 'infrastructure', 'environment', 'public-safety', 'health', 'education', 'transportation', 'community-services', 'youth', 'other'];

export function validateReport(values) {
  const title = values.title?.trim() || '';
  const description = values.description?.trim() || '';
  if (title.length < 6 || title.length > 120) throw new Error('Use a title between 6 and 120 characters.');
  if (description.length < 12 || description.length > 4000) throw new Error('Describe the concern in 12 to 4,000 characters.');
  if (!CATEGORY_SLUGS.includes(values.category)) throw new Error('Choose a valid concern category.');
  if (!MUNICIPALITIES.includes(values.municipality)) throw new Error('Choose an Eastern Samar municipality or Borongan City.');
  if ((values.barangay || '').trim().length > 100) throw new Error('Use a barangay name of at most 100 characters.');
  if (!['low', 'normal', 'high', 'urgent'].includes(values.priority)) throw new Error('Choose a valid urgency.');
  if (values.location) {
    const { lat, lng } = values.location;
    const [[south, west], [north, east]] = PROVINCE.bounds;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < south || lat > north || lng < west || lng > east) {
      throw new Error('Choose a map point within the Eastern Samar map extent.');
    }
  }
  if (values.incidentAt && !Number.isFinite(Date.parse(values.incidentAt))) throw new Error('Choose a valid incident date.');
  if (values.neededBy && (!/^\d{4}-\d{2}-\d{2}$/.test(values.neededBy) || !Number.isFinite(Date.parse(values.neededBy)))) throw new Error('Choose a valid needed-by date.');
  return { ...values, title, description, barangay: (values.barangay || '').trim() };
}

// Keep review and resolution distinct even when reading the legacy status column.
export function reportLifecycle(report) {
  const verification = report.verification_status || (report.status === 'verified' || ['in_progress', 'resolved'].includes(report.status) && report.verified_at ? 'verified' : ['approved', 'in_progress', 'resolved'].includes(report.status) ? 'approved' : ['rejected', 'needs_more_information', 'under_review'].includes(report.status) ? report.status : 'pending_review');
  const resolution = report.resolution_status || (['in_progress', 'resolved'].includes(report.status) ? report.status : 'open');
  return { verification, resolution };
}

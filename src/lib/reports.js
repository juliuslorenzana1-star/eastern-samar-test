import { supabase } from './supabase.js';

const reportColumns = [
  'id',
  'title',
  'description',
  'category_slug',
  'municipality',
  'barangay',
  'latitude',
  'longitude',
  'incident_at',
  'needed_by',
  'priority',
  'status',
  'is_public',
  'created_at',
  'updated_at',
  'verified_at',
  'resolved_at',
].join(',');

export const reportStatuses = [
  'pending_review',
  'under_review',
  'needs_more_information',
  'approved',
  'verified',
  'in_progress',
  'resolved',
  'rejected',
];

// The only statuses a report can hold once it is allowed on the public map.
// This mirrors is_public inside the moderate_report() database function, so the
// client and the server agree on what "approved for publication" means.
export const publicReportStatuses = ['approved', 'verified', 'in_progress', 'resolved'];

export const reportPriorities = ['low', 'normal', 'high', 'urgent'];

// Friendlier wording for the two review states a resident actually sees.
const statusLabels = {
  needs_more_information: 'More information requested',
};

export function formatStatus(status) {
  return statusLabels[status] ?? status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isPubliclyVisible(report) {
  return Boolean(report.is_public) && publicReportStatuses.includes(report.status);
}

export function getImageFormat(file) {
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return null;
}

export async function validateEvidenceFile(file) {
  const extension = getImageFormat(file);
  if (!extension) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.');

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const matchesContent = extension === 'jpg' ? isJpeg : extension === 'png' ? isPng : isWebp;
  if (!matchesContent) throw new Error('The selected file does not match its image type.');

  return { extension };
}

export async function fetchPublicReports() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reports')
    .select(reportColumns)
    .eq('is_public', true)
    .in('status', publicReportStatuses)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  // Defensive second pass: even if a policy is ever loosened, a report that is not
  // approved cannot be rendered on the public map or list.
  return (data ?? []).filter(isPubliclyVisible);
}

// A signed-in resident reading their own submissions.
//
// Prefer the RPC, which filters by auth.uid() server-side. Older databases may
// have the authenticated reporter_id grant but not the RPC. The compatibility
// query below always filters ownership; it never asks for all unpublished rows.
export async function fetchMyReports(userId) {
  if (!supabase || !userId) return [];
  const { data: own, error: rpcError } = await supabase.rpc('my_reports');
  if (!rpcError) return own ?? [];

  if (!['PGRST202', '42883', '42501'].includes(rpcError.code)) {
    throw new Error('Your submissions could not be loaded. Check your connection and try again.');
  }
  const query = (columns) => supabase.from('reports').select(columns)
    .eq('reporter_id', userId).order('created_at', { ascending: false }).limit(100);
  let { data, error } = await query(`${reportColumns},decision_note,reviewed_at`);
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    ({ data, error } = await query(reportColumns));
  }
  if (error) {
    if (['42501', 'PGRST202'].includes(error.code)) {
      throw new Error('Submission history needs a database setup repair: the my_reports function is unavailable and the owner-filtered lookup is not permitted. Your saved reports have not been deleted.');
    }
    throw new Error('Your submissions could not be loaded. Check your connection and try again.');
  }
  return data ?? [];
}

// The moderation queue. Returns every report the caller is allowed to see, which
// for a moderator is the whole table (pending ones included) and for a resident is
// nothing beyond their own rows.
export async function fetchReports() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reports')
    .select(reportColumns)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function fetchReportCategories() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('report_categories')
    .select('slug,name,sort_order')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfile(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,role,show_on_leaderboard')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function sendEmailNotification(payload) {
  if (!supabase) return { ok: false, skipped: true, reason: 'supabase_unavailable' };
  try {
    const { data, error } = await supabase.functions.invoke('send-email-notification', {
      body: payload,
    });
    if (error) {
      console.warn('Email notification failed.', error);
      return { ok: false, skipped: false, error };
    }
    if (data?.skipped) {
      return { ok: false, skipped: true, reason: data.reason || 'email_not_configured' };
    }
    return { ok: data?.accepted === true || data?.status === 'accepted', data };
  } catch (error) {
    console.warn('Email notification failed.', error);
    return { ok: false, skipped: false, error };
  }
}

export async function fetchProfiles() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,role,created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEvidence(reportId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('report_evidence')
    .select('id,object_path,content_type,byte_size,created_at')
    .eq('report_id', reportId)
    .order('created_at');
  if (error) throw error;
  const evidence = await Promise.all((data ?? []).map(async (item) => {
    const { data: signed, error: signedError } = await supabase.storage
      .from('report-evidence')
      .createSignedUrl(item.object_path, 300);
    if (signedError) throw signedError;
    return { ...item, url: signed.signedUrl };
  }));
  return evidence;
}

export async function fetchAIReview(reportId) {
  if (!supabase) return { run: null, flags: [] };
  const [runResult, flagResult] = await Promise.all([
    supabase.from('ai_review_runs')
      .select('status,model_name,checked_at')
      .eq('report_id', reportId)
      .maybeSingle(),
    supabase.from('ai_review_flags')
      .select('id,flag_type,confidence,explanation,model_name,created_at')
      .eq('report_id', reportId)
      .order('created_at'),
  ]);
  if (runResult.error) throw runResult.error;
  if (flagResult.error) throw flagResult.error;
  return { run: runResult.data ?? null, flags: flagResult.data ?? [] };
}

export async function createReport(values, userId) {
  if (!supabase || !userId) throw new Error('Sign in before submitting a report.');
  const evidenceType = values.evidence
    ? await validateEvidenceFile(values.evidence)
    : null;

  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      title: values.title.trim(),
      description: values.description.trim(),
      category_slug: values.category,
      municipality: values.municipality,
      barangay: values.barangay.trim() || null,
      latitude: values.location?.lat ?? null,
      longitude: values.location?.lng ?? null,
      incident_at: values.incidentAt || null,
      needed_by: values.neededBy || null,
      priority: values.priority,
    })
    .select(reportColumns)
    .single();
  if (error) throw error;

  const warnings = [];
  if (values.location) {
    const { error: locationError } = await supabase.from('report_private_locations').insert({
      report_id: report.id,
      latitude: values.location.lat,
      longitude: values.location.lng,
    });
    if (locationError) warnings.push('Report saved with an approximate public location; exact location storage needs moderator setup.');
  }

  if (values.evidence) {
    try {
      const { extension } = evidenceType;
      const objectPath = `${report.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('report-evidence')
        .upload(objectPath, values.evidence, { contentType: values.evidence.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: metadataError } = await supabase.from('report_evidence').insert({
        report_id: report.id,
        uploaded_by: userId,
        object_path: objectPath,
        content_type: values.evidence.type,
        byte_size: values.evidence.size,
      });
      if (metadataError) throw metadataError;
    } catch {
      warnings.push('Report saved, but the evidence upload failed. You can retry from your account.');
    }
  }

  try {
    const emailResult = await sendEmailNotification({
      type: 'report_submission',
      report_id: report.id,
      report_title: report.title,
      municipality: report.municipality,
      barangay: report.barangay,
    });
    if (!emailResult.ok) {
      warnings.push('Report saved. A confirmation email could not be confirmed; check My submissions for your report.');
    }
  } catch {
    warnings.push('Report submitted successfully. Your confirmation email may be delayed while the email service is being configured.');
  }

  try {
    const { data: screening, error: screeningError } = await supabase.functions.invoke('analyze-report', {
      body: { reportId: report.id },
    });
    if (screeningError || screening?.status !== 'completed') {
      warnings.push('Automated screening is unavailable; your report remains pending human review.');
    }
  } catch {
    warnings.push('Automated screening is unavailable; your report remains pending human review.');
  }

  return { report, warning: warnings.join(' ') };
}

export async function moderateReport({ reportId, status, priority, note, residentNote }) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const args = {
    target_report_id: reportId,
    next_status: status,
    next_priority: priority,
    internal_note: note || null,
  };
  let { error } = await supabase.rpc('moderate_report', { ...args, resident_note: residentNote || null });
  // PGRST202 = the five-argument overload is not in this project yet, which means
  // the review-decision migration has not been applied. Retry on the older shape so
  // the review queue keeps working; the resident-facing reason is simply not stored.
  if (error && error.code === 'PGRST202') {
    ({ error } = await supabase.rpc('moderate_report', args));
  }
  if (error) throw error;
}

export async function setProfileRole(userId, role) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

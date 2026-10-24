import { supabase } from './supabase.js';

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

export async function fetchVolunteerOpportunities() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('volunteer_opportunities')
    .select('id,project_id,report_id,title,description,category,municipality,barangay,location,latitude,longitude,starts_at,ends_at,capacity,status,registration_open,skills,tasks,what_to_bring,organizer_id,organizer_name,created_at')
    .in('status', ['published', 'active', 'open', 'full', 'ongoing', 'completed', 'cancelled'])
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchVolunteerRegistrations(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .select('id,opportunity_id,volunteer_id,status,joined_at,completed_at,volunteer_hours,created_at,opportunity:volunteer_opportunities!inner(id,title,description,category,municipality,barangay,location,latitude,longitude,starts_at,ends_at,capacity,status,registration_open,organizer_id,organizer_name)')
    .eq('volunteer_id', userId)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchVolunteerSignupIds(userId) {
  const registrations = await fetchVolunteerRegistrations(userId);
  return registrations
    .filter((registration) => !['cancelled', 'no_show'].includes(registration.status))
    .map((registration) => registration.opportunity_id);
}

export async function fetchVolunteerSignupCounts(opportunityIds) {
  if (!supabase || !opportunityIds.length) return {};
  const { data, error } = await supabase.rpc('get_volunteer_signup_counts', {
    p_opportunity_ids: opportunityIds,
  });
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.opportunity_id, Number(row.signup_count)]));
}

export async function fetchVolunteerCommunityTotals() {
  if (!supabase) return { volunteersJoined: 0, communityHours: 0 };
  const { data, error } = await supabase.rpc('get_volunteer_community_totals');
  if (error) throw error;
  const totals = data?.[0] ?? {};
  return {
    volunteersJoined: Number(totals.volunteers_joined ?? 0),
    communityHours: Number(totals.community_hours ?? 0),
  };
}

export async function fetchVolunteerLeaderboard() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_public_leaderboard');
  if (error) throw error;
  return (data ?? []).map((entry) => ({
    rank: Number(entry.rank ?? 0),
    displayName: entry.display_name ?? 'Community member',
    communityHours: Number(entry.community_hours ?? 0),
    volunteerActivities: Number(entry.volunteer_activities ?? 0),
  }));
}

export async function fetchVolunteerPrivacy(userId) {
  if (!supabase) throw new Error('The shared database is not configured.');
  if (!userId) throw new Error('Sign in to manage your public visibility.');
  const { data, error } = await supabase.from('profiles').select('public_alias').eq('id', userId).single();
  if (error) throw new Error('Public aliases need the pending database update. You can still keep your participation private.');
  return data;
}

export async function updateProfileLeaderboardVisibility(showOnLeaderboard, publicAlias) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Sign in to update your public visibility.');
  const updates = { show_on_leaderboard: Boolean(showOnLeaderboard) };
  if (showOnLeaderboard) {
    if (!publicAlias?.trim() || publicAlias.trim().length > 80) throw new Error('Choose a public name between 1 and 80 characters.');
    updates.public_alias = publicAlias.trim();
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.user.id)
    .select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Your visibility preference could not be saved.');
}

export async function registerForVolunteerOpportunity(opportunityId) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { error } = await supabase.rpc('join_volunteer_opportunity', { p_opportunity_id: opportunityId });
  if (error) throw error;
  // The record exists before any email request; email errors never undo joining.
  const notification = await sendEmailNotification({ type: 'volunteer_registration', opportunity_id: opportunityId });
  return { notification };
}

export async function cancelVolunteerRegistration(registrationId) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .update({ status: 'cancelled' })
    .eq('id', registrationId)
    .eq('status', 'registered')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This registration is no longer eligible for cancellation.');
}

export async function fetchVolunteerManagementOverview() {
  if (!supabase) return { opportunities: [], signupCounts: {} };
  const loadOpportunities = (columns) => supabase
    .from('volunteer_opportunities')
    .select(columns)
    .order('created_at', { ascending: false });
  const { data: opportunities, error } = await loadOpportunities('id,report_id,title,municipality,status,registration_open,starts_at,capacity,created_at');
  if (error) throw error;

  const signupCounts = await fetchVolunteerSignupCounts((opportunities ?? []).map(({ id }) => id));
  return { opportunities: opportunities ?? [], signupCounts };
}

export async function fetchOpportunityRegistrations(opportunityId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .select('id,opportunity_id,volunteer_id,status,joined_at,completed_at,volunteer_hours,volunteer:profiles!volunteer_registrations_volunteer_id_fkey(display_name)')
    .eq('opportunity_id', opportunityId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateVolunteerRegistration(registrationId, { status, volunteerHours }) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { error } = await supabase.rpc('record_volunteer_attendance', {
    p_registration_id: registrationId,
    p_status: status,
    p_volunteer_hours: volunteerHours === '' ? null : Number(volunteerHours),
  });
  if (error) throw error;
}

export async function updateVolunteerOpportunityStatus(opportunityId, status) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { error } = await supabase.from('volunteer_opportunities').update({ status }).eq('id', opportunityId);
  if (error) throw error;
}

export async function setVolunteerSignup(opportunityId, userId, shouldJoin) {
  if (!supabase || !userId) throw new Error('Sign in to manage volunteer signups.');
  if (!shouldJoin) throw new Error('Use the registration cancellation flow.');
  await registerForVolunteerOpportunity(opportunityId);
}

export async function createVolunteerOpportunity({
  report, title, description, startsAt, endsAt, capacity, category, barangay,
  municipality, location, latitude, longitude, skills, tasks, whatToBring,
}) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { data, error } = await supabase
    .from('volunteer_opportunities')
    .insert({
      report_id: report?.id ?? null,
      title: title.trim(),
      description: description.trim(),
      municipality: municipality || report?.municipality || null,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      capacity: capacity ? Number(capacity) : null,
      category: category || report?.category_slug || null,
      barangay: barangay ?? report?.barangay ?? null,
      location: location || null,
      latitude: latitude ?? report?.latitude ?? null,
      longitude: longitude ?? report?.longitude ?? null,
      skills: skills ?? [],
      tasks: tasks ?? [],
      what_to_bring: whatToBring ?? [],
      organizer_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      status: 'published',
    })
    .select('id,report_id,title,description,municipality,barangay,starts_at,ends_at,capacity,status,created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function updateVolunteerOpportunity(opportunityId, {
  title, description, startsAt, endsAt, capacity, category, municipality, barangay,
  location, latitude, longitude, skills, tasks, whatToBring,
}) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { error } = await supabase.from('volunteer_opportunities').update({
    title: title.trim(),
    description: description.trim(),
    municipality: municipality || null,
    starts_at: startsAt || null,
    ends_at: endsAt || null,
    capacity: capacity ? Number(capacity) : null,
    category: category || null,
    barangay: barangay || null,
    location: location || null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    skills: skills ?? [],
    tasks: tasks ?? [],
    what_to_bring: whatToBring ?? [],
  }).eq('id', opportunityId);
  if (error) throw error;
}

export async function setVolunteerRegistrationOpen(opportunityId, registrationOpen) {
  if (!supabase) throw new Error('The shared database is not configured.');
  const { error } = await supabase.from('volunteer_opportunities')
    .update({ registration_open: registrationOpen }).eq('id', opportunityId);
  if (error) throw error;
}

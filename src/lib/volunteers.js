import { supabase } from './supabase.js';

export async function fetchVolunteerOpportunities() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('volunteer_opportunities')
    .select('id,project_id,title,description,municipality,starts_at,ends_at,capacity,status,created_at')
    .in('status', ['published', 'active'])
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchVolunteerSignupIds(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('volunteer_signups')
    .select('opportunity_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((signup) => signup.opportunity_id);
}

export async function setVolunteerSignup(opportunityId, userId, shouldJoin) {
  if (!supabase || !userId) throw new Error('Sign in to manage volunteer signups.');
  const query = supabase.from('volunteer_signups');
  const result = shouldJoin
    ? await query.insert({ opportunity_id: opportunityId, user_id: userId })
    : await query.delete().eq('opportunity_id', opportunityId).eq('user_id', userId);
  if (result.error) throw result.error;
}
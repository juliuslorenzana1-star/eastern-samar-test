import { createClient } from '@supabase/supabase-js';

function looksLikePlaceholder(value) {
  if (!value) return true;
  return /^(your_|replace_|example|dummy|placeholder|changeme|required)/i.test(value)
    || /supabase.*(required|placeholder)|api key required/i.test(value);
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl
  && supabasePublishableKey
  && !looksLikePlaceholder(supabaseUrl)
  && !looksLikePlaceholder(supabasePublishableKey)
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

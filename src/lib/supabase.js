import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // "implicit" lets a sign-in link work even if it opens in a different browser
    // than the one that asked for it (common when the app is on the home screen).
    flowType: 'implicit',
    storageKey: 'pb-auth',
  },
})

export async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

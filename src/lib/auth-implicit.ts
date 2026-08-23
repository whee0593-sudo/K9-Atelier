import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Password-reset emails must not use PKCE. That flow stores a one-time
 * verifier in the requesting browser, so opening the same email on a phone
 * always fails. Implicit tokens travel in the link itself.
 */
export function createImplicitAuthClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

import { createBrowserClient } from "@supabase/ssr";
import {
  readRememberMeFromDocument,
  withRememberMeCookieOptions,
} from "@/lib/auth-remember";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  const remember = readRememberMeFromDocument();
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: withRememberMeCookieOptions(undefined, remember),
  });
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  isRememberMeEnabled,
  REMEMBER_ME_COOKIE,
  withRememberMeCookieOptions,
} from "@/lib/auth-remember";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();
  const remember = isRememberMeEnabled(
    cookieStore.get(REMEMBER_ME_COOKIE)?.value,
  );

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(
              name,
              value,
              withRememberMeCookieOptions(options, remember),
            );
          });
        } catch {
          // Server Components cannot always write cookies; middleware refreshes sessions.
        }
      },
    },
  });
}

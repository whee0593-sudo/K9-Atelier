import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextResponse, type NextRequest } from "next/server";
import {
  isRememberMeEnabled,
  REMEMBER_ME_COOKIE,
  withRememberMeCookieOptions,
} from "@/lib/auth-remember";
import { nextWithPathname } from "@/lib/request-path";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

type SessionResult = {
  response: NextResponse;
  user: User | null;
};

export async function refreshSupabaseSession(
  request: NextRequest,
): Promise<SessionResult> {
  let response = nextWithPathname(request);

  const remember = isRememberMeEnabled(
    request.cookies.get(REMEMBER_ME_COOKIE)?.value,
  );

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = nextWithPathname(request);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(
            name,
            value,
            withRememberMeCookieOptions(options, remember),
          );
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

export function copySupabaseCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

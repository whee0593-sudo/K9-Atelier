import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import business from "../content/business.json";
import { nextWithPathname } from "@/lib/request-path";
import {
  isPrivacyGateActive,
  isValidSiteAccessCookie,
} from "@/lib/site-access";
import {
  copySupabaseCookies,
  refreshSupabaseSession,
} from "@/lib/supabase/middleware";
import { hasSupabaseConfig } from "@/lib/supabase/env";

const PUBLIC_PATHS = [
  "/under-construction",
  "/login",
  "/login/admin",
  "/auth/callback",
  "/auth/reset",
  "/api/site-access",
  "/preview",
  "/support",
  "/privacy",
  "/terms",
  "/referrals",
  "/api/support",
  "/api/notify",
  "/api/cron",
  "/api/sms",
  "/api/voice",
];

const CUSTOMER_PROTECTED_PREFIXES = ["/account"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isCustomerProtectedPath(pathname: string) {
  return CUSTOMER_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (hasSupabaseConfig()) {
    const { response: sessionResponse, user } =
      await refreshSupabaseSession(request);

    if (isCustomerProtectedPath(pathname) && !user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      loginUrl.searchParams.delete("error");
      const redirectResponse = NextResponse.redirect(loginUrl);
      return copySupabaseCookies(sessionResponse, redirectResponse);
    }

    const privacyMode = isPrivacyGateActive(
      business.site?.privacyMode === true,
    );

    if (!privacyMode) {
      return sessionResponse;
    }

    const accessCookie = request.cookies.get("k9-site-access")?.value;
    if (await isValidSiteAccessCookie(accessCookie)) {
      return sessionResponse;
    }

    if (isPublicPath(pathname)) {
      return sessionResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/under-construction";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    return copySupabaseCookies(sessionResponse, redirectResponse);
  }

  const privacyMode = isPrivacyGateActive(business.site?.privacyMode === true);

  if (!privacyMode) {
    return nextWithPathname(request);
  }

  const accessCookie = request.cookies.get("k9-site-access")?.value;
  if (await isValidSiteAccessCookie(accessCookie)) {
    return nextWithPathname(request);
  }

  if (isPublicPath(pathname)) {
    return nextWithPathname(request);
  }

  const url = request.nextUrl.clone();
  url.pathname = "/under-construction";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

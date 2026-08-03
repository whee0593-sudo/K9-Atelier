import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import business from "../content/business.json";
import {
  isPrivacyGateActive,
  isValidSiteAccessCookie,
} from "@/lib/site-access";

const PUBLIC_PATHS = [
  "/under-construction",
  "/login/admin",
  "/api/site-access",
  "/support",
  "/api/support",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(request: NextRequest) {
  const privacyMode = isPrivacyGateActive(business.site?.privacyMode === true);

  if (!privacyMode) {
    return NextResponse.next();
  }

  const accessCookie = request.cookies.get("k9-site-access")?.value;
  if (await isValidSiteAccessCookie(accessCookie)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
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

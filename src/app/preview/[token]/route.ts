import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  grantSiteAccessCookie,
  isValidPreviewShareToken,
  SITE_ACCESS_COOKIE,
  siteAccessCookieOptions,
} from "@/lib/site-access";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  if (!isValidPreviewShareToken(token)) {
    return NextResponse.redirect(new URL("/under-construction", request.url));
  }

  const accessToken = await grantSiteAccessCookie();
  if (!accessToken) {
    return NextResponse.redirect(new URL("/under-construction", request.url));
  }

  const next = request.nextUrl.searchParams.get("next");
  const destination =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(
    SITE_ACCESS_COOKIE,
    accessToken,
    siteAccessCookieOptions(),
  );
  return response;
}

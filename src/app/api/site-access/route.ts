import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  computeSiteAccessToken,
  getSiteAccessPassword,
  isValidSiteAccessCookie,
  SITE_ACCESS_COOKIE,
} from "@/lib/site-access";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function POST(request: Request) {
  const password = getSiteAccessPassword();
  if (!password) {
    return NextResponse.json(
      {
        error:
          "Site access is not configured. Add SITE_ACCESS_PASSWORD in this Vercel project's Environment Variables, then redeploy.",
      },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const submitted = body.password?.trim();
  if (!submitted || submitted !== password) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const token = await computeSiteAccessToken(password);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SITE_ACCESS_COOKIE, token, cookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SITE_ACCESS_COOKIE, "", {
    ...cookieOptions(),
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const configured = Boolean(getSiteAccessPassword());
  const cookie = request.cookies.get(SITE_ACCESS_COOKIE)?.value;
  const authenticated = configured
    ? await isValidSiteAccessCookie(cookie)
    : false;

  return NextResponse.json({
    configured,
    authenticated,
    message: !configured
      ? "Add SITE_ACCESS_PASSWORD in this Vercel project's Environment Variables, then redeploy."
      : authenticated
        ? "Team access active."
        : "Sign in at /login/admin to preview the site.",
  });
}

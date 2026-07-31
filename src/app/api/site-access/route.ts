import { NextResponse } from "next/server";
import {
  computeSiteAccessToken,
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
  const password = process.env.SITE_ACCESS_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "Site access is not configured." },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.password || body.password !== password) {
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

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie")?.match(
    new RegExp(`${SITE_ACCESS_COOKIE}=([^;]+)`),
  )?.[1];

  const ok = await isValidSiteAccessCookie(cookie);
  return NextResponse.json({ ok });
}

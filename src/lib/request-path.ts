import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export const PATHNAME_HEADER = "x-k9-pathname";

export function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export async function readRequestPathname(fallback = "/") {
  const headerList = await headers();
  const value = headerList.get(PATHNAME_HEADER)?.trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (value.includes("?") || value.includes("#") || value.includes("..")) {
    return fallback;
  }
  return value;
}

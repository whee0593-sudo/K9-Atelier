import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Strip Stripe authentication query parameters before rendering a page with GTM.
// This route never trusts the query as proof of a saved card and never writes data.
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/request-a-call", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

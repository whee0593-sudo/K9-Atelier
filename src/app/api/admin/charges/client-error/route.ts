import { NextResponse } from "next/server";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { getStaffSession } from "@/lib/staff/auth";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if ("error" in session) return mapStaffServiceError(session.error);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = { parse: "failed" };
  }

  console.error("checkout stripe client error:", body);
  return NextResponse.json({ ok: true });
}

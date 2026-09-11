import { NextResponse } from "next/server";
import { isRegisteredEmailFrozen } from "@/lib/auth/frozen-lookup";
import { enforceIpRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "frozenCheck");
  if (limited) return limited;

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ frozen: false });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const frozen = await isRegisteredEmailFrozen(email);
  return NextResponse.json({ frozen });
}

import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/rate-limit";
import { confirmStaffBookingFromEmail } from "@/lib/staff/confirm-customer-booking";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "confirmAccount");
  if (limited) return limited;
  try {
    const body: unknown = await request.json();
    const token = body && typeof body === "object" && "token" in body && typeof body.token === "string" ? body.token.trim() : "";
    const result = await confirmStaffBookingFromEmail(token);
    if ("error" in result) {
      const expired = result.error === "expired";
      const invalid = result.error === "not_found";
      return NextResponse.json({ error: expired
        ? "This confirmation link has expired. Please contact penny@k9atelier.com"
        : invalid ? "This confirmation link is not valid."
        : "We could not confirm your appointment. Please try again or contact penny@k9atelier.com" },
      { status: expired ? 410 : invalid ? 404 : result.error === "frozen" ? 403 : 500 });
    }
    if ("needsAddress" in result) return NextResponse.json({ needsAddress: true }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ confirmed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "We could not confirm your appointment. Please try again." }, { status: 400 });
  }
}

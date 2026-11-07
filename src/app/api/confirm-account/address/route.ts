import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/rate-limit";
import { saveCustomerConfirmAddress } from "@/lib/staff/confirm-customer-booking";
import { hasServiceAddress } from "@/lib/staff/booking-address";
import type { ServiceAddress } from "@/lib/travel";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "confirmAccount");
  if (limited) return limited;
  try {
    const body = await request.json();
    const address: ServiceAddress = { street: "", city: "", state: "", zip: "" };
    for (const key of Object.keys(address) as (keyof ServiceAddress)[]) {
      if (typeof body?.address?.[key] !== "string") return NextResponse.json({ error: "Enter your street, city, state, and ZIP code." }, { status: 400 });
      address[key] = body.address[key].trim();
    }
    if (!hasServiceAddress(address) || address.street.length > 200 || address.city.length > 120 || address.state.length > 40 || address.zip.length > 20) {
      return NextResponse.json({ error: "Enter a complete, valid service address." }, { status: 400 });
    }
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const result = await saveCustomerConfirmAddress(token, address);
    if ("error" in result) return NextResponse.json({ error: "message" in result ? result.message : "This confirmation link is unavailable. Please contact K9 Atelier." }, { status: result.error === "conflict" ? 409 : result.error === "not_found" ? 404 : result.error === "expired" ? 410 : 400 });
    return NextResponse.json(result.preview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("POST confirm-account/address failed:", error instanceof Error ? error.message : "Invalid request");
    return NextResponse.json({ error: "We could not save your address. Please try again." }, { status: 400 });
  }
}

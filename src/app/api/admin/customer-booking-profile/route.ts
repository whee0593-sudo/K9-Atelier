import { NextResponse } from "next/server";
import { isBookingCustomerId } from "@/lib/staff/customer-booking-profile";
import { lookupStaffBookingProfile } from "@/lib/staff/lookup-booking-profile";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId")?.trim() ?? "";
  const email = url.searchParams.get("email")?.trim() ?? "";
  const phone = url.searchParams.get("phone")?.trim() ?? "";

  if (!customerId && !email && !phone) {
    return staffJsonError("Enter a customer email or mobile phone number.", 400);
  }
  if (customerId && !isBookingCustomerId(customerId)) {
    return staffJsonError("Invalid customer id.", 400);
  }

  try {
    const result = await lookupStaffBookingProfile({
      customerId,
      email,
      phone,
    });
    if ("error" in result) return mapStaffServiceError(result.error);
    return NextResponse.json({ profile: result.profile });
  } catch (error) {
    console.error("GET /api/admin/customer-booking-profile failed:", error);
    return staffJsonError("Something went wrong. Please try again.", 500);
  }
}

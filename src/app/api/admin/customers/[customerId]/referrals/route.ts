import { NextResponse } from "next/server";
import { jsonError } from "@/lib/pets/errors";
import { ProfileValidationError, validateCustomerId } from "@/lib/profiles/validation";
import { getAccountReferralView } from "@/lib/referrals/service";
import { getStaffSession } from "@/lib/staff/auth";
import { mapStaffServiceError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getStaffSession();
    if ("error" in session) return mapStaffServiceError(session.error);

    const { customerId: rawId } = await context.params;
    const customerId = validateCustomerId(rawId);
    const view = await getAccountReferralView(customerId);
    return NextResponse.json(view);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("GET /api/admin/customers/[customerId]/referrals failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}

import { NextResponse } from "next/server";
import { validateAppointmentId } from "@/lib/appointments/validation";
import { cancelStaffAppointment, quoteStaffCancellation } from "@/lib/appointments/staff-cancellation";
import { setAppointmentStatus } from "@/lib/appointments/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { appointmentId } = await context.params;
    const result = await quoteStaffCancellation(validateAppointmentId(appointmentId));
    if (result.error) return mapStaffServiceError(result.error);
    return NextResponse.json(result.quote);
  } catch (error) {
    console.error("Staff cancellation quote failed:", error);
    return mapStaffServiceError("server");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { appointmentId: rawAppointmentId } = await context.params;
    const appointmentId = validateAppointmentId(rawAppointmentId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return staffJsonError("Invalid request body.", 400);
    }

    const status =
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      (body.status === "confirmed" || body.status === "cancelled")
        ? body.status
        : null;

    if (!status) {
      return staffJsonError('Status must be "confirmed" or "cancelled".', 400);
    }

    const fee = body as { expectedPolicyFee?: unknown; amount?: unknown };
    const result = status === "cancelled"
      ? await cancelStaffAppointment(appointmentId, fee.expectedPolicyFee, fee.amount)
      : await setAppointmentStatus(appointmentId, status);

    if ("error" in result) {
      switch (result.error) {
        case "fee_changed":
          return staffJsonError("The cancellation fee changed. Reopen the dialog to review it.", 409);
        case "invalid_fee":
          return staffJsonError("Enter $0 to waive the fee or an amount between $0.50 and the policy fee.", 400);
        case "payment_required":
          return staffJsonError("No saved payment method. Add one or waive the fee to cancel.", 409);
        case "payment_failed":
          return staffJsonError("The card could not be charged. The appointment is still booked.", 409);
        case "payment_pending":
          return staffJsonError("The card payment is pending. Reopen this dialog to check the same payment.", 409);
        case "payment_unknown":
        case "change_review":
          return staffJsonError("The cancellation needs review. Check the payment before trying again.", 409);
        case "price_review_required":
        case "coverage_review_required":
          return staffJsonError("Review the saved visit price or prior policy charges before cancelling.", 409);
        case "visit_busy":
          return staffJsonError("Another change for this visit is still finishing.", 409);
        default:
          return mapStaffServiceError(result.error ?? "server");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Staff appointment update failed:", error);
    return mapStaffServiceError("server");
  }
}

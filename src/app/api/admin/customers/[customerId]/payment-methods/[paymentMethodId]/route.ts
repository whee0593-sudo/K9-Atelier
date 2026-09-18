import { NextResponse } from "next/server";
import { deleteStaffCustomerPaymentMethod } from "@/lib/payments/service";
import { jsonError } from "@/lib/pets/errors";
import { ProfileValidationError, validateCustomerId } from "@/lib/profiles/validation";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ customerId: string; paymentMethodId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { customerId: rawId, paymentMethodId } = await context.params;
    const customerId = validateCustomerId(rawId);
    if (!UUID_PATTERN.test(paymentMethodId)) {
      return staffJsonError("Invalid payment method.", 400);
    }

    const result = await deleteStaffCustomerPaymentMethod(customerId, paymentMethodId);
    if ("error" in result) {
      if (result.error === "conflict") {
        return staffJsonError(
          "This card is attached to an upcoming appointment and cannot be removed yet.",
          409,
        );
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error(
      "DELETE /api/admin/customers/[customerId]/payment-methods failed:",
      error,
    );
    return jsonError("Something went wrong. Please try again.", 500);
  }
}

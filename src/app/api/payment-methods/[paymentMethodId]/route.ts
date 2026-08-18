import { NextResponse } from "next/server";
import { deleteCustomerPaymentMethod } from "@/lib/payments/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ paymentMethodId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { paymentMethodId } = await context.params;
  if (!UUID_PATTERN.test(paymentMethodId)) {
    return staffJsonError("Invalid payment method.", 400);
  }

  const result = await deleteCustomerPaymentMethod(paymentMethodId);
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
}

import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import {
  createStaffCustomerSetupIntent,
  saveStaffCustomerPaymentMethod,
} from "@/lib/payments/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await context.params;
  let body: { setupIntentId?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as typeof body;
  } catch {
    return staffJsonError("Invalid request.", 400);
  }

  if (body.setupIntentId) {
    const result = await saveStaffCustomerPaymentMethod(customerId, body.setupIntentId);
    if ("error" in result) return mapStaffServiceError(result.error);
    return NextResponse.json(result);
  }

  const result = await createStaffCustomerSetupIntent(customerId);
  if ("error" in result) return mapStaffServiceError(result.error);
  return NextResponse.json(result);
}

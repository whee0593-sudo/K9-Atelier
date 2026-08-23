import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { listStaffCustomerHistory } from "@/lib/charges/history";

export async function GET(
  _request: Request,
  context: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await context.params;
  if (!customerId) return staffJsonError("Missing customer.", 400);

  const result = await listStaffCustomerHistory(customerId);
  if ("error" in result) return mapStaffServiceError(result.error);
  return NextResponse.json(result);
}

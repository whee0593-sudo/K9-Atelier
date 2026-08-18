import { NextResponse } from "next/server";
import { listStaffCustomers } from "@/lib/profiles/staff-service";
import { mapStaffServiceError } from "@/lib/staff/api-errors";

export async function GET() {
  const result = await listStaffCustomers();
  if ("error" in result) {
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json({ customers: result.customers });
}

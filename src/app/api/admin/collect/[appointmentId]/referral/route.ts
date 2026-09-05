import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { getStaffSession } from "@/lib/staff/auth";
import { fetchAppointmentAdminRecord } from "@/lib/email/appointment-context";
import { applyReferralCodeForCollect } from "@/lib/referrals/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const session = await getStaffSession();
  if ("error" in session) {
    return mapStaffServiceError(session.error);
  }

  const { appointmentId } = await context.params;
  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return staffJsonError("Invalid request.", 400);
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return staffJsonError("Enter a referral code.", 400);
  }

  const appointment = await fetchAppointmentAdminRecord(appointmentId);
  if (!appointment) {
    return staffJsonError("Appointment not found.", 404);
  }

  const result = await applyReferralCodeForCollect({
    customerId: appointment.customerId,
    appointmentId,
    appointmentDate: appointment.appointmentDate,
    addressStreet: appointment.addressStreet,
    addressZip: appointment.addressZip,
    code,
  });

  if (!result.ok) {
    return staffJsonError(result.message, 409);
  }

  return NextResponse.json({
    referral: result.referral,
    message: result.message,
  });
}

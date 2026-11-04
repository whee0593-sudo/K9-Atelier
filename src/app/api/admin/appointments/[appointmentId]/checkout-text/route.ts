import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/staff/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCheckoutReadySms } from "@/lib/sms/checkout";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { validateAppointmentId } from "@/lib/appointments/validation";

export async function POST(_request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  const session = await getStaffSession();
  if ("error" in session) return mapStaffServiceError(session.error);
  try {
    const appointmentId = validateAppointmentId((await context.params).appointmentId);
    const admin = createAdminClient();
    const { data, error } = await admin.from("appointments")
      .select("status, service_ended_at, visits ( service_ended_at )").eq("id", appointmentId).maybeSingle();
    if (error) return mapStaffServiceError("server");
    if (!data || data.status === "cancelled") return mapStaffServiceError("not_found");
    const visit = Array.isArray(data.visits) ? data.visits[0] : data.visits;
    if (!(visit?.service_ended_at ?? data.service_ended_at)) return staffJsonError("Check out before sending the completion text.", 409);
    if (!await sendCheckoutReadySms(appointmentId)) {
      return staffJsonError("Could not send the check out text. Try again or uncheck the text option to continue.", 503);
    }
    return NextResponse.json({ sent: true });
  } catch {
    return mapStaffServiceError("server");
  }
}

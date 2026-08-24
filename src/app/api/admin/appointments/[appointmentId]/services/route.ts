import { NextResponse } from "next/server";
import { validateAppointmentId } from "@/lib/appointments/validation";
import { updateAppointmentVisitServices } from "@/lib/appointments/visit-services";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId: rawId } = await context.params;
    const appointmentId = validateAppointmentId(rawId);
    const body = (await request.json().catch(() => null)) as {
      lineItems?: unknown;
    } | null;

    const result = await updateAppointmentVisitServices({
      appointmentId,
      lineItems: body?.lineItems,
    });

    if ("error" in result) {
      if (result.error === "invalid") {
        return staffJsonError(
          "Add at least one service, with amounts between $0 and $5,000.",
          409,
        );
      }
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json(result);
  } catch {
    return mapStaffServiceError("not_found");
  }
}

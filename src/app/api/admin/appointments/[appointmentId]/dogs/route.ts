import { NextResponse } from "next/server";
import { addStaffDogToVisit } from "@/lib/appointments/customer-change";
import { AppointmentValidationError, validateAppointmentId } from "@/lib/appointments/validation";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  try {
    const appointmentId = validateAppointmentId((await context.params).appointmentId);
    const body = await request.json().catch(() => null);
    if (typeof body?.petId !== "string" || typeof body?.serviceId !== "string" || !body.serviceId.trim()) {
      return staffJsonError("Choose a dog and a service.", 400);
    }
    const result = await addStaffDogToVisit(appointmentId, validateAppointmentId(body.petId), body.serviceId);
    if (!("error" in result)) return NextResponse.json({ ok: true });
    switch (result.error) {
      case "slot_unavailable":
        return staffJsonError("There is not enough time at this arrival to add the dog. Reschedule the visit or refresh the calendar and try again.", 409);
      case "weight_required":
        return staffJsonError("Add the dog's weight to their profile first.", 409);
      case "payment_required":
        return staffJsonError("Add a saved payment method for this customer first.", 409);
      case "allergy_unavailable":
        return mapStaffServiceError("server");
      default:
        return mapStaffServiceError(result.error);
    }
  } catch (error) {
    if (error instanceof AppointmentValidationError) return staffJsonError(error.message, 400);
    console.error("Staff add dog failed:", error);
    return mapStaffServiceError("server");
  }
}

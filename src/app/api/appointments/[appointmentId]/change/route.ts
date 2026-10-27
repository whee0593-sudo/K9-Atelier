import { NextResponse } from "next/server";
import {
  appointmentJsonError,
  handleAppointmentRouteError,
  mapAppointmentServiceError,
} from "@/lib/appointments/errors";
import {
  applyAppointmentChange,
  quoteAppointmentChange,
} from "@/lib/appointments/customer-change";
import type { AppointmentChangeAction } from "@/lib/appointments/change-policy";
import { isWithinServiceDay } from "@/lib/booking-schedule";

const ACTIONS: AppointmentChangeAction[] = [
  "reschedule",
  "cancel",
  "add_dog",
  "remove_dog",
];

function readAction(value: unknown): AppointmentChangeAction | null {
  return typeof value === "string" &&
    ACTIONS.includes(value as AppointmentChangeAction)
    ? (value as AppointmentChangeAction)
    : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const { appointmentId } = await context.params;
  const url = new URL(request.url);
  const action = readAction(url.searchParams.get("action"));
  if (!action) {
    return appointmentJsonError("Choose a change to preview.", 400);
  }

  const slotParam = url.searchParams.get("slotStartMinutes");
  const slotStartMinutes =
    slotParam != null && Number.isFinite(Number(slotParam))
      ? Number(slotParam)
      : undefined;
  const date = url.searchParams.get("date") ?? undefined;
  const result = await quoteAppointmentChange(
    appointmentId,
    action,
    url.searchParams.get("removeAppointmentId") ?? undefined,
    date && slotStartMinutes != null
      ? { date, slotStartMinutes }
      : undefined,
  );

  if ("error" in result) {
    if (result.error === "conflict") {
      return appointmentJsonError(
        "This appointment can no longer be changed.",
        409,
      );
    }
    return mapAppointmentServiceError(result.error);
  }

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await context.params;
    const body = (await request.json()) as {
      action?: unknown;
      date?: unknown;
      slotStartMinutes?: unknown;
      timePreference?: unknown;
      petId?: unknown;
      serviceId?: unknown;
      removeAppointmentId?: unknown;
      expectedAmount?: unknown;
    };
    const action = readAction(body.action);
    if (!action) {
      return appointmentJsonError("Choose a change to confirm.", 400);
    }

    const slotStartMinutes =
      typeof body.slotStartMinutes === "number" &&
      isWithinServiceDay(body.slotStartMinutes)
        ? body.slotStartMinutes
        : body.timePreference === "afternoon"
          ? 12 * 60
          : body.timePreference === "morning"
            ? 9 * 60
            : undefined;

    const result = await applyAppointmentChange({
      appointmentId,
      action,
      date: typeof body.date === "string" ? body.date : undefined,
      slotStartMinutes,
      petId: typeof body.petId === "string" ? body.petId : undefined,
      serviceId: typeof body.serviceId === "string" ? body.serviceId : undefined,
      removeAppointmentId:
        typeof body.removeAppointmentId === "string"
          ? body.removeAppointmentId
          : undefined,
      expectedAmount:
        typeof body.expectedAmount === "number" ? body.expectedAmount : undefined,
    });

    if ("error" in result) {
      if (result.error === "payment_failed") {
        return appointmentJsonError(
          "We could not charge the card on file. Please update your payment method and try again.",
          409,
        );
      }
      if (result.error === "payment_pending") {
        return appointmentJsonError(
          "This card is waiting for confirmation. Nothing else was charged. Confirm again to finish the same payment.",
          409,
        );
      }
      if (result.error === "payment_unknown") {
        return appointmentJsonError(
          "We could not confirm whether this card was charged. Nothing else will be charged until this payment is reviewed. Please contact us.",
          409,
        );
      }
      if (result.error === "misconfigured") {
        return appointmentJsonError(
          "Card charges are unavailable right now. Please contact us to finish this change.",
          409,
        );
      }
      if (result.error === "weight_required") {
        return appointmentJsonError(
          "Add this dog's weight before booking. Weight must be greater than 0 and at most 200 lbs.",
          409,
          "weightLbs",
        );
      }
      if (result.error === "price_review_required" || result.error === "coverage_review_required") {
        return appointmentJsonError(
          "We need to review this visit's saved price before a change fee can be charged. Please contact us. Nothing has been charged.",
          409,
        );
      }
      if (result.error === "fee_changed") {
        return appointmentJsonError(
          "The fee changed. Review the amount and confirm again. Nothing new has been charged.",
          409,
        );
      }
      if (result.error === "visit_busy") {
        return appointmentJsonError(
          "Another change for this visit is still finishing. Please wait a moment and try again.",
          409,
        );
      }
      if (result.error === "change_review") {
        return appointmentJsonError(
          "This visit changed before the update could be saved. The confirmed fee was charged once, and the appointment was not changed again. Please contact us so we can review it.",
          409,
        );
      }
      if (result.error === "conflict") {
        return appointmentJsonError(
          "This appointment can no longer be changed that way.",
          409,
        );
      }
      return mapAppointmentServiceError(result.error);
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleAppointmentRouteError(error);
  }
}

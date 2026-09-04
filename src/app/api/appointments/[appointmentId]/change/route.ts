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
import { listHourlyStartMinutes } from "@/lib/booking-schedule";

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

  const result = await quoteAppointmentChange(
    appointmentId,
    action,
    url.searchParams.get("removeAppointmentId") ?? undefined,
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
    };
    const action = readAction(body.action);
    if (!action) {
      return appointmentJsonError("Choose a change to confirm.", 400);
    }

    const slotStartMinutes =
      typeof body.slotStartMinutes === "number" &&
      listHourlyStartMinutes().includes(body.slotStartMinutes)
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
    });

    if ("error" in result) {
      if (result.error === "payment_failed") {
        return appointmentJsonError(
          "We could not charge the card on file. Please update your payment method and try again.",
          409,
        );
      }
      if (result.error === "misconfigured") {
        return appointmentJsonError(
          "Card charges are unavailable right now. Please contact us to finish this change.",
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

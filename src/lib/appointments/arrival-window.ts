import type { TimePreference } from "@/lib/booking-schedule";

/** Shown when scheduling has not produced a window. Never a reason to reject a booking. */
export const ARRIVAL_WINDOW_PENDING_LABEL = "Arrival window to be confirmed";

export type ArrivalWindowResult =
  | {
      insertion: {
        appointmentTime: string;
        scheduledStart: number;
        usedPreference: TimePreference;
      };
    }
  | { error: string };

export type ResolvedBookingSchedule = {
  /** Null when the studio has not generated a window yet. */
  appointmentTime: string | null;
  scheduledStart: number;
  timePreference: TimePreference;
};

/**
 * The customer chooses a bookable slot. The arrival window is assigned later
 * by scheduling. A missing window must not reject or roll back the booking.
 * An unavailable slot still blocks.
 */
export function resolveArrivalForBooking(
  assignment: ArrivalWindowResult,
  _slotStartMinutes: number,
): ResolvedBookingSchedule | { error: "slot_unavailable" } {
  if (!("error" in assignment)) {
    return {
      appointmentTime: assignment.insertion.appointmentTime,
      scheduledStart: assignment.insertion.scheduledStart,
      timePreference: assignment.insertion.usedPreference,
    };
  }

  return { error: "slot_unavailable" };
}

export function displayAppointmentTime(time: string | null | undefined) {
  const trimmed = time?.trim();
  return trimmed || ARRIVAL_WINDOW_PENDING_LABEL;
}

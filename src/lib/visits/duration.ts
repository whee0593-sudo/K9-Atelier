import type { AppointmentStatus } from "@/lib/appointments/types";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";

export type ResolvedDuration =
  | {
      unknown: false;
      minutes: number;
      /** True only for a future active row that had no stored snapshot. */
      persistLiveEstimate: boolean;
    }
  | {
      unknown: true;
      minutes: null;
      persistLiveEstimate: false;
    };

/**
 * A stored positive duration is the snapshot and is never replaced.
 * Null on a cancelled, completed, or past row stays unknown.
 * Null on a future confirmed or pending row may use today's catalog
 * estimate. Callers persist that estimate only while rewriting the schedule.
 */
export function resolveAppointmentDuration(input: {
  storedMinutes: number | null | undefined;
  status: AppointmentStatus;
  appointmentDate: string;
  serviceEndedAt?: string | null;
  liveEstimateMinutes: number;
  today?: string;
}): ResolvedDuration {
  if (
    typeof input.storedMinutes === "number" &&
    Number.isInteger(input.storedMinutes) &&
    input.storedMinutes > 0
  ) {
    return {
      unknown: false,
      minutes: input.storedMinutes,
      persistLiveEstimate: false,
    };
  }

  const today = input.today ?? todayInBusinessTimezone();
  const finished =
    input.status === "cancelled" ||
    Boolean(input.serviceEndedAt) ||
    input.appointmentDate < today;
  if (finished) {
    return { unknown: true, minutes: null, persistLiveEstimate: false };
  }

  const bookable =
    input.status === "confirmed" || input.status === "pending_confirmation";
  if (
    bookable &&
    input.appointmentDate >= today &&
    Number.isInteger(input.liveEstimateMinutes) &&
    input.liveEstimateMinutes > 0
  ) {
    return {
      unknown: false,
      minutes: input.liveEstimateMinutes,
      persistLiveEstimate: true,
    };
  }

  return { unknown: true, minutes: null, persistLiveEstimate: false };
}

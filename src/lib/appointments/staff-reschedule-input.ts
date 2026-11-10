import { isWithinServiceDay } from "@/lib/booking-schedule";
import { bookingWeightLbs } from "@/lib/pets/weight";
import { getBookableServicesForPet, getServicePriceEstimate } from "@/lib/services";
import {
  parseDateValue,
  toDateValue,
} from "@/lib/booking-slots";
import { isStaffBookingDate } from "@/lib/staff/booking-dates";
import {
  addDaysToIsoDate,
  todayInBusinessTimezone,
} from "@/lib/sms/schedule";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAST_CORRECTION_DAYS = 60;

export function staffRescheduleServices(weight: unknown) {
  const lbs = bookingWeightLbs(weight);
  return lbs == null ? [] : getBookableServicesForPet(lbs, { includeMembersOnly: true })
    .filter((service) => getServicePriceEstimate(service, lbs) != null);
}

export function parseStaffAppointmentEdit(body: unknown):
  | { serviceId?: string; date?: string; slotStartMinutes?: number }
  | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid request body." };
  }
  const record = body as { serviceId?: unknown; date?: unknown; slotStartMinutes?: unknown };
  const serviceId = record.serviceId;
  if (serviceId !== undefined && (typeof serviceId !== "string" || !serviceId.trim())) {
    return { error: "Choose a valid service." };
  }
  if (serviceId && record.date === undefined && record.slotStartMinutes === undefined) {
    return { serviceId, date: undefined, slotStartMinutes: undefined };
  }
  const schedule = parseStaffRescheduleInput(record);
  if ("error" in schedule) return schedule;
  return { ...schedule, serviceId };
}

export function isStaffAssignableDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = parseDateValue(date);
  if (toDateValue(parsed) !== date) return false;
  if (isStaffBookingDate(date)) return true;
  const today = todayInBusinessTimezone();
  if (date > today) return false;
  return date >= addDaysToIsoDate(today, -PAST_CORRECTION_DAYS);
}

export function parseStaffRescheduleInput(
  body: unknown,
): { date: string; slotStartMinutes: number } | { error: string } {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Date and start time are required." };
  }
  const record = body as { date?: unknown; slotStartMinutes?: unknown };
  const date = typeof record.date === "string" ? record.date.trim() : "";
  const slotStartMinutes = record.slotStartMinutes;
  if (!DATE_PATTERN.test(date)) {
    return { error: "Choose a date as YYYY-MM-DD." };
  }
  if (
    typeof slotStartMinutes !== "number" ||
    !Number.isInteger(slotStartMinutes) ||
    !isWithinServiceDay(slotStartMinutes)
  ) {
    return { error: "Choose a valid start time." };
  }
  if (!isStaffAssignableDate(date)) {
    return { error: "That date is not available for booking." };
  }
  return { date, slotStartMinutes };
}

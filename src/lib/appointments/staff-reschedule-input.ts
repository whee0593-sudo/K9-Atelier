import { listHourlyStartMinutes } from "@/lib/booking-schedule";
import {
  isBookableWeekday,
  isDateBookable,
  parseDateValue,
} from "@/lib/booking-slots";
import {
  addDaysToIsoDate,
  todayInBusinessTimezone,
} from "@/lib/sms/schedule";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAST_CORRECTION_DAYS = 60;

export function isStaffAssignableDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = parseDateValue(date);
  if (!isBookableWeekday(parsed)) return false;
  if (isDateBookable(parsed)) return true;
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
    !listHourlyStartMinutes().includes(slotStartMinutes)
  ) {
    return { error: "Choose a valid start time." };
  }
  if (!isStaffAssignableDate(date)) {
    return { error: "That date is not available for booking." };
  }
  return { date, slotStartMinutes };
}

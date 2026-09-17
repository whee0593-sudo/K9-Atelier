import { listHourlyStartMinutes } from "@/lib/booking-schedule";
import {
  isBookableWeekday,
  isDateBookable,
  parseDateValue,
} from "@/lib/booking-slots";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isStaffAssignableDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = parseDateValue(date);
  if (isDateBookable(parsed)) return true;
  return date === todayInBusinessTimezone() && isBookableWeekday(parsed);
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

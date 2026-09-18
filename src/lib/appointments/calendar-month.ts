import type { AdminCalendarDay } from "@/lib/appointments/calendar";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";

export const ADMIN_CALENDAR_WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export function formatCalendarMonthLabel(month: string) {
  const [year, monthText] = month.split("-").map(Number);
  return new Date(year, monthText - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function shiftCalendarMonth(month: string, delta: number) {
  const [year, monthText] = month.split("-").map(Number);
  const next = new Date(year, monthText - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function calendarMonthFromDate(value: string) {
  return value.slice(0, 7);
}

export function currentBusinessCalendarMonth(now = new Date()) {
  return calendarMonthFromDate(todayInBusinessTimezone(now));
}

export function isAdminCalendarDayMuted(
  day: Pick<AdminCalendarDay, "isPast" | "isFull" | "closure">,
) {
  return (
    day.isPast ||
    day.isFull ||
    Boolean(day.closure?.closedAllDay) ||
    Boolean(day.closure?.closedHours.length)
  );
}

export function adminCalendarDayButtonClass(
  day: Pick<AdminCalendarDay, "isPast" | "isFull" | "isToday" | "closure">,
  selected: boolean,
) {
  const muted = isAdminCalendarDayMuted(day);
  return `min-h-16 border-t border-l border-lavender/15 px-1.5 py-2 text-left ${
    muted ? "bg-lavender-light/70 text-text-muted" : "bg-white text-text"
  } ${selected ? "ring-2 ring-inset ring-gold" : ""}`;
}

export function calendarMonthLeadingBlanks(days: Array<{ date: string }>) {
  if (days.length === 0) return 0;
  return new Date(`${days[0]!.date}T12:00:00`).getDay();
}

/** Month grid with occupancy counts, used when the live admin calendar cannot load. */
export function buildEmptyOccupancyMonth(
  month: string,
  today: string,
): AdminCalendarDay[] {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const days: AdminCalendarDay[] = [];
  for (let day = 1; day <= last; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    days.push({
      date,
      appointmentCount: 0,
      isPast: date < today,
      isFull: false,
      isToday: date === today,
      closure: null,
      closureLabel: null,
    });
  }
  return days;
}

import { getEarliestBookableDate, parseDateValue, toDateValue } from "@/lib/booking-slots";

/** Staff can book all weekdays; public booking retains its configured weekdays. */
export function isStaffBookingDate(date: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = parseDateValue(date);
  return toDateValue(parsed) === date && parsed >= getEarliestBookableDate(now);
}

export function getUpcomingStaffDates(count = 20) {
  const cursor = getEarliestBookableDate();
  return Array.from({ length: count }, () => {
    const value = toDateValue(cursor);
    const label = cursor.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    cursor.setDate(cursor.getDate() + 1);
    return { value, label };
  });
}

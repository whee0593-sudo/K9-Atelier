import { business } from "./business";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Half-hour slots from hoursStart up to (but not including) hoursEnd */
export function getTimeSlots() {
  const [startH, startM] = business.booking.hoursStart.split(":").map(Number);
  const [endH, endM] = business.booking.hoursEnd.split(":").map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  const slots: string[] = [];

  for (let m = start; m < end; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 ? "AM" : "PM";
    slots.push(
      `${hour12}:${min.toString().padStart(2, "0")} ${ampm}`,
    );
  }

  return slots;
}

export function isBookableWeekday(date: Date) {
  const key = DAY_KEYS[date.getDay()];
  return business.booking.availableDays.includes(key);
}

/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export function toDateValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateValue(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Bookable if weekday, not today, and not in the past. */
export function isDateBookable(date: Date) {
  const cursor = new Date(date);
  cursor.setHours(12, 0, 0, 0);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const earliest = new Date(today);
  earliest.setDate(earliest.getDate() + 1);
  if (cursor < earliest) return false;
  return isBookableWeekday(cursor);
}

/** Open time slots for a date. Replace with calendar API when live. */
export function getAvailableTimeSlotsForDate(date: Date) {
  if (!isDateBookable(date)) return [];
  return getTimeSlots();
}

/** Next N bookable calendar dates (local date, Mon–Fri) */
export function getUpcomingBookableDates(count = 20) {
  const dates: { value: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);

  while (dates.length < count) {
    if (isDateBookable(cursor)) {
      const value = toDateValue(cursor);
      const label = cursor.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      dates.push({ value, label });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

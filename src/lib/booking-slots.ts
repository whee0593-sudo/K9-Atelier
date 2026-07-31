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

/** Next N bookable calendar dates (local date, Mon–Fri) */
export function getUpcomingBookableDates(count = 20) {
  const dates: { value: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  // Start from tomorrow so same-day buffer is simple for preview
  cursor.setDate(cursor.getDate() + 1);

  while (dates.length < count) {
    if (isBookableWeekday(cursor)) {
      const value = cursor.toISOString().slice(0, 10);
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

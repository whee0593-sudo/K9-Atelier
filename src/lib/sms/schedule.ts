import { business } from "@/lib/business";

/** Calendar date (YYYY-MM-DD) in the business timezone. */
export function todayInBusinessTimezone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: business.booking.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Add calendar days to a YYYY-MM-DD date without timezone shift. */
export function addDaysToIsoDate(dateYmd: string, days: number) {
  const [year, month, day] = dateYmd.split("-").map(Number);
  if (!year || !month || !day) return dateYmd;
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Hour 0–23 in the business timezone. */
export function hourInBusinessTimezone(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: business.booking.timezone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

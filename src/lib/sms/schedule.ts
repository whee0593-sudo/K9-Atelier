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

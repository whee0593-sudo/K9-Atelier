import { listHourlyStartMinutes } from "@/lib/booking-schedule";
import { getUpcomingBookableDates, parseDateValue } from "@/lib/booking-slots";

export type StaffAvailabilityDay = {
  date: string;
  available: boolean;
  slots: number[];
};

/** Studio calendar days with standard start hours, before live route availability. */
export function fallbackStaffScheduleDays(count = 20): StaffAvailabilityDay[] {
  return getUpcomingBookableDates(count).map((day) => ({
    date: day.value,
    available: true,
    slots: listHourlyStartMinutes(),
  }));
}

/** Dates staff can actually book — open and with at least one start hour. */
export function selectableStaffDays(days: StaffAvailabilityDay[]) {
  return days.filter((day) => day.available && day.slots.length > 0);
}

export function slotsForStaffDate(days: StaffAvailabilityDay[], date: string) {
  if (!date) return [];
  const match = days.find((day) => day.date === date);
  if (!match?.available) return [];
  return match.slots;
}

export function formatStaffDateOption(date: string) {
  return parseDateValue(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export type StaffScheduleHintInput = {
  quoteReady: boolean;
  hasService: boolean;
  loading: boolean;
  error: string | null;
  daysLoaded: boolean;
  selectedDate: string;
  availableDayCount: number;
  slotCount: number;
};

export function staffScheduleHint(input: StaffScheduleHintInput): string | null {
  if (input.error) return null;
  if (!input.quoteReady) {
    return "Studio dates are listed. Check the service area to confirm the travel fee and remaining hours.";
  }
  if (!input.hasService) {
    return "Choose a service to confirm remaining start times for this address.";
  }
  if (input.loading) {
    return "Loading available times…";
  }
  if (input.daysLoaded && input.availableDayCount === 0) {
    return "No start times are open for this address and service. Try another service, or check the studio schedule.";
  }
  if (!input.selectedDate) {
    return "Select a date to see available start hours.";
  }
  if (input.slotCount === 0) {
    return "No start times remain on this day. Choose another date.";
  }
  return null;
}

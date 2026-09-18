import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import { listHourlyStartMinutes } from "@/lib/booking-schedule";
import {
  fallbackStaffScheduleDays,
  formatStaffDateOption,
  selectableStaffDays,
  slotsForStaffDate,
  staffScheduleHint,
  type StaffAvailabilityDay,
} from "@/lib/staff/book-for-customer-schedule";

const monday: StaffAvailabilityDay = {
  date: "2026-09-21",
  available: true,
  slots: [9 * 60, 10 * 60],
};
const tuesdayClosed: StaffAvailabilityDay = {
  date: "2026-09-22",
  available: false,
  slots: [],
};
const wednesdayEmpty: StaffAvailabilityDay = {
  date: "2026-09-23",
  available: true,
  slots: [],
};

describe("fallbackStaffScheduleDays", () => {
  it("lists upcoming studio days with hourly start times", () => {
    const first = getUpcomingBookableDates(1)[0];
    assert.ok(first);
    const days = fallbackStaffScheduleDays(3);
    assert.equal(days.length, 3);
    assert.equal(days[0]?.date, first.value);
    assert.equal(days[0]?.available, true);
    assert.ok((days[0]?.slots.length ?? 0) > 0);
  });
});

describe("selectableStaffDays", () => {
  it("keeps only open days that still have start hours", () => {
    assert.deepEqual(
      selectableStaffDays([monday, tuesdayClosed, wednesdayEmpty]),
      [monday],
    );
  });
});

describe("slotsForStaffDate", () => {
  const days = [monday, tuesdayClosed, wednesdayEmpty];

  it("returns slots for an open date", () => {
    assert.deepEqual(slotsForStaffDate(days, "2026-09-21"), [9 * 60, 10 * 60]);
  });

  it("returns no slots for a closed date, empty date, or empty hours", () => {
    assert.deepEqual(slotsForStaffDate(days, "2026-09-22"), []);
    assert.deepEqual(slotsForStaffDate(days, "2026-09-23"), []);
    assert.deepEqual(slotsForStaffDate(days, ""), []);
  });

  it("falls back to studio hours when the chosen date is missing from availability", () => {
    assert.deepEqual(
      slotsForStaffDate(days, "2026-09-24"),
      listHourlyStartMinutes(),
    );
  });
});

describe("formatStaffDateOption", () => {
  it("labels a local calendar date without shifting the weekday", () => {
    assert.equal(formatStaffDateOption("2026-09-21"), "Mon, Sep 21");
  });
});

describe("staffScheduleHint", () => {
  const ready = {
    quoteReady: true,
    hasService: true,
    loading: false,
    error: null,
    daysLoaded: true,
    selectedDate: "2026-09-21",
    availableDayCount: 3,
    slotCount: 2,
  };

  it("prompts to check the service area after studio dates are listed", () => {
    assert.match(
      staffScheduleHint({ ...ready, quoteReady: false, daysLoaded: false }) ?? "",
      /studio dates are listed/i,
    );
  });

  it("prompts to choose a service after the address is ready", () => {
    assert.match(
      staffScheduleHint({ ...ready, hasService: false, daysLoaded: false }) ?? "",
      /choose a service/i,
    );
  });

  it("explains when no dates have open hours", () => {
    assert.match(
      staffScheduleHint({
        ...ready,
        selectedDate: "",
        availableDayCount: 0,
        slotCount: 0,
      }) ?? "",
      /no start times are open/i,
    );
  });

  it("asks for a date before listing hours", () => {
    assert.match(
      staffScheduleHint({ ...ready, selectedDate: "", slotCount: 0 }) ?? "",
      /select a date/i,
    );
  });

  it("returns null when a date and times are ready", () => {
    assert.equal(staffScheduleHint(ready), null);
  });
});

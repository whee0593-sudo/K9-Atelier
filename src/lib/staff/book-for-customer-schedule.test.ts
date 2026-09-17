import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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

  it("returns no slots for a closed date, empty date, or missing date", () => {
    assert.deepEqual(slotsForStaffDate(days, "2026-09-22"), []);
    assert.deepEqual(slotsForStaffDate(days, "2026-09-23"), []);
    assert.deepEqual(slotsForStaffDate(days, ""), []);
    assert.deepEqual(slotsForStaffDate(days, "2026-09-24"), []);
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

  it("prompts to check the service area before times can load", () => {
    assert.match(
      staffScheduleHint({ ...ready, quoteReady: false, daysLoaded: false }) ?? "",
      /service area/i,
    );
  });

  it("prompts to choose a service after the address is ready", () => {
    assert.match(
      staffScheduleHint({ ...ready, hasService: false, daysLoaded: false }) ?? "",
      /service/i,
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

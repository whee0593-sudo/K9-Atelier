import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminCalendarDayButtonClass,
  buildEmptyOccupancyMonth,
  calendarMonthFromDate,
  formatCalendarMonthLabel,
  isAdminCalendarDayMuted,
  isStaffPickerDaySelectable,
  shiftCalendarMonth,
  staffPickerSelectableDates,
} from "@/lib/appointments/calendar-month";

const openDay = {
  isPast: false,
  isFull: false,
  isToday: false,
  closure: null,
};

describe("calendar month helpers", () => {
  it("labels and shifts YYYY-MM values", () => {
    assert.equal(formatCalendarMonthLabel("2026-09"), "September 2026");
    assert.equal(shiftCalendarMonth("2026-09", 1), "2026-10");
    assert.equal(shiftCalendarMonth("2026-01", -1), "2025-12");
    assert.equal(calendarMonthFromDate("2026-09-21"), "2026-09");
  });

  it("mutes past, full, and closed days the same way as the admin calendar", () => {
    assert.equal(isAdminCalendarDayMuted(openDay), false);
    assert.equal(isAdminCalendarDayMuted({ ...openDay, isPast: true }), true);
    assert.equal(isAdminCalendarDayMuted({ ...openDay, isFull: true }), true);
    assert.equal(
      isAdminCalendarDayMuted({
        ...openDay,
        closure: { serviceDate: "2026-09-21", closedAllDay: true, closedHours: [] },
      }),
      true,
    );
  });

  it("uses gray for muted days and white for days that still have room", () => {
    assert.match(adminCalendarDayButtonClass(openDay, false), /bg-white/);
    assert.match(
      adminCalendarDayButtonClass({ ...openDay, isFull: true }, false),
      /bg-lavender-light\/70/,
    );
    assert.match(adminCalendarDayButtonClass(openDay, true), /ring-gold/);
  });

  it("builds a local month grid when occupancy data is missing", () => {
    const days = buildEmptyOccupancyMonth("2026-09", "2026-09-18");
    assert.equal(days.length, 30);
    assert.equal(days[0]?.date, "2026-09-01");
    assert.equal(days[0]?.isPast, true);
    assert.equal(days[17]?.date, "2026-09-18");
    assert.equal(days[17]?.isToday, true);
    assert.equal(days[20]?.isPast, false);
  });

  it("keeps a day with a blocked hour selectable for staff booking", () => {
    const monday = {
      date: "2026-09-21",
      isPast: false,
      isFull: false,
      closure: {
        serviceDate: "2026-09-21",
        closedAllDay: false,
        closedHours: [12],
      },
    };
    assert.equal(isAdminCalendarDayMuted(monday), true);
    assert.equal(isStaffPickerDaySelectable(monday), true);
    assert.equal(
      isStaffPickerDaySelectable({ ...monday, isFull: true }),
      false,
    );
    assert.equal(
      isStaffPickerDaySelectable({
        ...monday,
        closure: {
          serviceDate: "2026-09-21",
          closedAllDay: true,
          closedHours: [],
        },
      }),
      false,
    );
  });

  it("does not lock selectable days to a previously chosen date", () => {
    const days = buildEmptyOccupancyMonth("2026-09", "2026-09-18");
    const selectable = staffPickerSelectableDates(days);
    assert.equal(selectable.has("2026-09-21"), true);
    assert.equal(selectable.has("2026-09-24"), true);
    assert.equal(selectable.has("2026-09-22"), true);
    assert.equal(selectable.has("2026-09-18"), false);
    assert.equal(selectable.has("2026-09-26"), false);
  });
});

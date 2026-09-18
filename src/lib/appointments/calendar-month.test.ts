import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminCalendarDayButtonClass,
  calendarMonthFromDate,
  formatCalendarMonthLabel,
  isAdminCalendarDayMuted,
  shiftCalendarMonth,
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
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStaffAssignableDate,
  parseStaffRescheduleInput,
} from "@/lib/appointments/staff-reschedule-input";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";

describe("staff reschedule input", () => {
  it("requires a date and hourly start time", () => {
    assert.deepEqual(parseStaffRescheduleInput(null), {
      error: "Date and start time are required.",
    });
    assert.deepEqual(parseStaffRescheduleInput({ date: "not-a-date" }), {
      error: "Choose a date as YYYY-MM-DD.",
    });
    assert.deepEqual(
      parseStaffRescheduleInput({ date: "2026-09-24", slotStartMinutes: 601 }),
      { error: "Choose a valid start time." },
    );
  });

  it("accepts an upcoming bookable weekday", () => {
    const date = getUpcomingBookableDates(1)[0]?.value;
    assert.ok(date);
    assert.equal(isStaffAssignableDate(date), true);
    assert.deepEqual(
      parseStaffRescheduleInput({ date, slotStartMinutes: 600 }),
      { date, slotStartMinutes: 600 },
    );
  });

  it("accepts today when the studio is open", () => {
    const today = todayInBusinessTimezone();
    const weekday = new Date(`${today}T12:00:00`).getDay();
    if (weekday === 0 || weekday === 6) {
      assert.equal(isStaffAssignableDate(today), false);
      return;
    }
    assert.equal(isStaffAssignableDate(today), true);
    assert.deepEqual(
      parseStaffRescheduleInput({ date: today, slotStartMinutes: 540 }),
      { date: today, slotStartMinutes: 540 },
    );
  });

  it("rejects a past weekday", () => {
    assert.equal(isStaffAssignableDate("2020-01-06"), false);
    assert.deepEqual(
      parseStaffRescheduleInput({
        date: "2020-01-06",
        slotStartMinutes: 600,
      }),
      { error: "That date is not available for booking." },
    );
  });
});

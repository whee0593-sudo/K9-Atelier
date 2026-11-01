import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStaffAssignableDate,
  parseStaffRescheduleInput,
} from "@/lib/appointments/staff-reschedule-input";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import { getUpcomingStaffDates } from "@/lib/staff/booking-dates";
import { addDaysToIsoDate, todayInBusinessTimezone } from "@/lib/sms/schedule";

describe("staff reschedule input", () => {
  it("allows staff to reschedule onto either weekend day", () => {
    const weekends = getUpcomingStaffDates(14).filter((day) => [0, 6].includes(new Date(`${day.value}T12:00:00`).getDay()));
    assert.ok(weekends.length >= 2);
    for (const { value: date } of weekends) {
      assert.deepEqual(parseStaffRescheduleInput({ date, slotStartMinutes: 600 }), { date, slotStartMinutes: 600 });
    }
    assert.equal(isStaffAssignableDate("2027-02-30"), false);
  });
  it("requires a date and a start inside studio hours", () => {
    assert.deepEqual(parseStaffRescheduleInput(null), {
      error: "Date and start time are required.",
    });
    assert.deepEqual(parseStaffRescheduleInput({ date: "not-a-date" }), {
      error: "Choose a date as YYYY-MM-DD.",
    });
    assert.deepEqual(
      parseStaffRescheduleInput({ date: "2026-09-24", slotStartMinutes: 8 * 60 }),
      { error: "Choose a valid start time." },
    );
    const upcoming = getUpcomingBookableDates(1)[0]?.value;
    assert.ok(upcoming);
    assert.deepEqual(
      parseStaffRescheduleInput({
        date: upcoming,
        slotStartMinutes: 13 * 60 + 38,
      }),
      { date: upcoming, slotStartMinutes: 13 * 60 + 38 },
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
    assert.equal(isStaffAssignableDate(today), true);
    assert.deepEqual(
      parseStaffRescheduleInput({ date: today, slotStartMinutes: 540 }),
      { date: today, slotStartMinutes: 540 },
    );
  });

  it("accepts a recent weekday so staff can correct a completed visit", () => {
    const today = todayInBusinessTimezone();
    for (let days = 0; days <= 7; days += 1) {
      const date = addDaysToIsoDate(today, -days);
      const weekday = new Date(`${date}T12:00:00`).getDay();
      if (weekday === 0 || weekday === 6) continue;
      assert.equal(isStaffAssignableDate(date), true);
      return;
    }
    assert.fail("expected a weekday in the last week");
  });

  it("rejects a weekday far in the past", () => {
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

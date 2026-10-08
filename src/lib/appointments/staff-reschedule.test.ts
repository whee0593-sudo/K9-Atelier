import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listStaffClockHourStarts,
  listStaffRescheduleDates,
  staffClockStartBlocked,
  staffOpenClockStarts,
} from "@/lib/appointments/staff-clock-window";
import {
  isStaffAssignableDate,
  parseStaffRescheduleInput,
} from "@/lib/appointments/staff-reschedule-input";
import type { AvailabilityBlock } from "@/lib/appointments/availability-blocks";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import { addDaysToIsoDate, todayInBusinessTimezone } from "@/lib/sms/schedule";

const middayBlock: AvailabilityBlock = {
  id: "block-midday",
  serviceDate: "2026-11-23",
  allDay: false,
  startMinutes: 12 * 60,
  endMinutes: 14 * 60,
  reason: "Personal",
};

describe("staff reschedule input", () => {
  it("requires a calendar date and a minute inside the civil day", () => {
    assert.deepEqual(parseStaffRescheduleInput(null), {
      error: "Date and start time are required.",
    });
    assert.deepEqual(parseStaffRescheduleInput({ date: "not-a-date" }), {
      error: "Choose a date as YYYY-MM-DD.",
    });
    const upcoming = getUpcomingBookableDates(1)[0]?.value;
    assert.ok(upcoming);
    assert.deepEqual(
      parseStaffRescheduleInput({ date: upcoming, slotStartMinutes: 8 * 60 }),
      { date: upcoming, slotStartMinutes: 8 * 60 },
    );
    assert.deepEqual(
      parseStaffRescheduleInput({
        date: upcoming,
        slotStartMinutes: 13 * 60 + 38,
      }),
      { date: upcoming, slotStartMinutes: 13 * 60 + 38 },
    );
    assert.deepEqual(
      parseStaffRescheduleInput({ date: upcoming, slotStartMinutes: 24 * 60 }),
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

  it("accepts today, including a late clock hour", () => {
    const today = todayInBusinessTimezone();
    assert.equal(isStaffAssignableDate(today), true);
    assert.deepEqual(
      parseStaffRescheduleInput({ date: today, slotStartMinutes: 23 * 60 }),
      { date: today, slotStartMinutes: 23 * 60 },
    );
  });

  it("accepts Sundays in the recent past and in the future", () => {
    const today = todayInBusinessTimezone();
    let pastSunday = "";
    for (let days = 0; days <= 7; days += 1) {
      const date = addDaysToIsoDate(today, -days);
      if (new Date(`${date}T12:00:00`).getDay() === 0) {
        pastSunday = date;
        break;
      }
    }
    assert.ok(pastSunday);
    assert.equal(isStaffAssignableDate(pastSunday), true);

    let futureSunday = "";
    for (let days = 0; days <= 7; days += 1) {
      const date = addDaysToIsoDate(today, days);
      if (new Date(`${date}T12:00:00`).getDay() === 0) {
        futureSunday = date;
        break;
      }
    }
    assert.ok(futureSunday);
    assert.deepEqual(
      parseStaffRescheduleInput({
        date: futureSunday,
        slotStartMinutes: 0,
      }),
      { date: futureSunday, slotStartMinutes: 0 },
    );
    assert.deepEqual(
      parseStaffRescheduleInput({
        date: futureSunday,
        slotStartMinutes: -1,
      }),
      { error: "Choose a valid start time." },
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

describe("staff clock arrival windows", () => {
  it("offers every hour from midnight through 11:00 PM", () => {
    const hours = listStaffClockHourStarts();
    assert.equal(hours.length, 24);
    assert.equal(hours[0], 0);
    assert.equal(hours[15], 15 * 60);
    assert.equal(hours[23], 23 * 60);
    const open = staffOpenClockStarts(null, [], 120);
    assert.deepEqual(open.slots, hours);
    assert.equal(open.slots.includes(15 * 60), true);
  });

  it("removes closure hours and blocked periods, including a start that runs into a block", () => {
    const closedHour = staffOpenClockStarts(
      {
        serviceDate: "2026-11-23",
        closedAllDay: false,
        closedHours: [15],
      },
      [],
      90,
    );
    assert.equal(closedHour.slots.includes(15 * 60), false);
    assert.equal(closedHour.slots.includes(14 * 60), true);
    assert.equal(closedHour.slots.includes(16 * 60), true);
    assert.equal(closedHour.slots.includes(23 * 60), true);
    assert.equal(
      staffClockStartBlocked(
        {
          serviceDate: "2026-11-23",
          closedAllDay: false,
          closedHours: [15],
        },
        [],
        15 * 60,
        60,
      ),
      true,
    );

    const partial = staffOpenClockStarts(null, [middayBlock], 60);
    assert.equal(partial.slots.includes(11 * 60), true);
    assert.equal(partial.slots.includes(12 * 60), false);
    assert.equal(partial.slots.includes(13 * 60), false);
    assert.equal(partial.slots.includes(14 * 60), true);
    assert.equal(partial.slots.includes(0), true);

    const runningIntoBlock = staffOpenClockStarts(null, [middayBlock], 120);
    assert.equal(runningIntoBlock.slots.includes(10 * 60), true);
    assert.equal(runningIntoBlock.slots.includes(11 * 60), false);

    const allDay = staffOpenClockStarts(
      null,
      [{ ...middayBlock, allDay: true, startMinutes: null, endMinutes: null }],
      60,
    );
    assert.deepEqual(allDay.slots, []);
    assert.equal(
      staffClockStartBlocked(
        { serviceDate: "2026-11-23", closedAllDay: true, closedHours: [] },
        [],
        23 * 60,
        60,
      ),
      true,
    );
  });

  it("lists every civil day, including Sundays, across the horizon", () => {
    const dates = listStaffRescheduleDates("2026-10-06", ["2026-11-23"]);
    assert.ok(dates.includes("2026-10-06"));
    assert.ok(dates.includes("2026-10-11"));
    assert.ok(dates.includes("2026-11-23"));
    assert.equal(dates.includes("2026-10-05"), false);
    assert.equal(dates.length, 120);
  });
});

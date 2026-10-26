import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBookableWeekday, isDateBookable, parseDateValue, isBookingStartInFuture, toDateValue, getEarliestBookableDate } from "./booking-slots";

describe("customer booking days", () => {
  it("allows Monday through Friday and blocks Saturday and Sunday", () => {
    const friday = new Date(2026, 9, 9);
    const saturday = new Date(2026, 9, 10);
    const sunday = new Date(2026, 9, 11);
    const monday = new Date(2026, 9, 12);
    assert.equal(friday.getDay(), 5);
    assert.equal(isBookableWeekday(friday), true);
    assert.equal(isBookableWeekday(monday), true);
    assert.equal(isBookableWeekday(saturday), false);
    assert.equal(isBookableWeekday(sunday), false);
  });
});

describe("same-day booking in Palm Beach", () => {
  it("allows today and 2 PM at 12:24 PM without a lead-time cutoff", () => {
    const now = new Date("2026-10-26T16:24:00Z");
    assert.equal(isDateBookable(parseDateValue("2026-10-26"), now), true);
    assert.equal(isDateBookable(parseDateValue("2026-10-25"), now), false);
    assert.equal(isBookingStartInFuture("2026-10-26", 840, now), true);
    assert.equal(isBookingStartInFuture("2026-10-26", 745, now), true);
    assert.equal(isBookingStartInFuture("2026-10-26", 744, now), false);
    assert.equal(isBookingStartInFuture("2026-10-26", 720, now), false);
  });

  it("uses the business day when UTC has already reached tomorrow", () => {
    const now = new Date("2026-10-27T00:30:00Z");
    assert.equal(toDateValue(getEarliestBookableDate(now)), "2026-10-26");
    assert.equal(isDateBookable(parseDateValue("2026-10-26"), now), true);
    assert.equal(isBookingStartInFuture("2026-10-26", 840, now), false);
    assert.equal(isBookingStartInFuture("2026-10-27", 540, now), true);
  });

  it("uses the winter daylight-saving offset for the start-time cutoff", () => {
    const now = new Date("2026-11-02T17:24:00Z");
    assert.equal(isBookingStartInFuture("2026-11-02", 745, now), true);
    assert.equal(isBookingStartInFuture("2026-11-02", 744, now), false);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBookableWeekday } from "./booking-slots";

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

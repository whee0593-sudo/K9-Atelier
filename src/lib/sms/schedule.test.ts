import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysToIsoDate,
  hourInBusinessTimezone,
} from "@/lib/sms/schedule";

describe("SMS schedule helpers", () => {
  it("adds calendar days without timezone shift", () => {
    assert.equal(addDaysToIsoDate("2026-07-05", 3), "2026-07-08");
    assert.equal(addDaysToIsoDate("2026-07-31", 3), "2026-08-03");
  });

  it("reads the 10am Eastern hour across DST, including weekends", () => {
    assert.equal(hourInBusinessTimezone(new Date("2026-08-23T14:00:00.000Z")), 10);
    assert.equal(hourInBusinessTimezone(new Date("2026-01-15T15:00:00.000Z")), 10);
    assert.equal(hourInBusinessTimezone(new Date("2026-08-22T14:00:00.000Z")), 10);
  });
});

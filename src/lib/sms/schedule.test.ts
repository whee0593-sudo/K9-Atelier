import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysToIsoDate,
  businessDayUtcRange,
  calendarDateInBusinessTimezone,
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

  it("reads a business calendar date across the Eastern offset", () => {
    assert.equal(
      calendarDateInBusinessTimezone(new Date("2026-09-02T03:30:00.000Z")),
      "2026-09-01",
    );
    assert.equal(
      calendarDateInBusinessTimezone(new Date("2026-09-02T04:30:00.000Z")),
      "2026-09-02",
    );
    assert.equal(
      calendarDateInBusinessTimezone(new Date("2026-01-15T04:30:00.000Z")),
      "2026-01-14",
    );
  });

  it("covers one Eastern calendar day, including DST boundaries", () => {
    assert.deepEqual(businessDayUtcRange("2026-09-02"), {
      start: "2026-09-02T04:00:00.000Z",
      end: "2026-09-03T04:00:00.000Z",
    });
    assert.deepEqual(businessDayUtcRange("2026-01-15"), {
      start: "2026-01-15T05:00:00.000Z",
      end: "2026-01-16T05:00:00.000Z",
    });
    assert.deepEqual(businessDayUtcRange("2026-03-08"), {
      start: "2026-03-08T05:00:00.000Z",
      end: "2026-03-09T04:00:00.000Z",
    });
    assert.deepEqual(businessDayUtcRange("2026-11-01"), {
      start: "2026-11-01T04:00:00.000Z",
      end: "2026-11-02T05:00:00.000Z",
    });
  });
});

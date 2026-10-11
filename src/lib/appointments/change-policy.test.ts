import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  changeFeeAmount,
  changeFeeWarning,
  changeNoticeBand,
} from "./change-policy";

describe("appointment change fees", () => {
  it("is complimentary 48+ hours before the visit", () => {
    const now = new Date("2026-08-20T15:00:00.000Z");
    const band = changeNoticeBand("2026-08-24", 10 * 60, now);
    assert.equal(band, "complimentary");
    assert.equal(changeFeeAmount("cancel", 140, band), 0);
    assert.equal(changeFeeAmount("reschedule", 140, band), 0);
    assert.equal(changeFeeAmount("remove_dog", 140, band), 0);
  });

  it("charges 50% when notice is under 48 hours and not same day", () => {
    const now = new Date("2026-08-23T22:00:00.000Z");
    const band = changeNoticeBand("2026-08-24", 10 * 60, now);
    assert.equal(band, "late");
    assert.equal(changeFeeAmount("cancel", 140, band), 70);
    assert.equal(changeFeeAmount("reschedule", 140, band), 70);
  });

  it("charges 100% for a same-day cancellation or reschedule", () => {
    const now = new Date("2026-08-24T13:00:00.000Z");
    const band = changeNoticeBand("2026-08-24", 15 * 60, now);
    assert.equal(band, "same_day");
    assert.equal(changeFeeAmount("cancel", 140, band), 140);
    assert.equal(changeFeeAmount("reschedule", 205, band), 205);
  });

  it("applies the percentage to the amount it is given, including a travel-inclusive total", () => {
    const now = new Date("2026-08-23T22:00:00.000Z");
    const band = changeNoticeBand("2026-08-24", 10 * 60, now);
    const servicePrice = 140;
    const travelFee = 33;
    assert.equal(band, "late");
    assert.equal(changeFeeAmount("cancel", servicePrice + travelFee, band), 86.5);
    assert.equal(changeFeeAmount("reschedule", servicePrice + travelFee, band), 86.5);
  });

  it("never charges a cancellation fee to add a dog", () => {
    const now = new Date("2026-08-24T13:00:00.000Z");
    const band = changeNoticeBand("2026-08-24", 15 * 60, now);
    assert.equal(changeFeeAmount("add_dog", 140, band), 0);
  });

  it("uses the confirm-and-pay wording", () => {
    assert.equal(
      changeFeeWarning(70),
      "This change will incur a $70.00 fee. Tapping Confirm will charge your card.",
    );
  });

  it("includes the visit travel fee in the cancellation and reschedule base", () => {
    const source = readFileSync(
      new URL("./customer-change.ts", import.meta.url),
      "utf8",
    );
    assert.match(
      source,
      /const estimatedTotal = Math\.round\(\(serviceTotal \+ travel\) \* 100\) \/ 100/,
    );
    assert.match(source, /action === "remove_dog"\s*\?\s*0/);
    assert.match(source, /fee: changeFeeAmount\(action, estimatedTotal, band\)/);
  });
});

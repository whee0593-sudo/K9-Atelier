import assert from "node:assert/strict";
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

  it("charges 100% for a same-day change", () => {
    const now = new Date("2026-08-24T13:00:00.000Z");
    const band = changeNoticeBand("2026-08-24", 15 * 60, now);
    assert.equal(band, "same_day");
    assert.equal(changeFeeAmount("cancel", 140, band), 140);
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
});

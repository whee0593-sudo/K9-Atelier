import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  changeFeeAmount,
  changeFeeWarning,
  changeNoticeBand,
} from "./change-policy";
import {
  addressServicePortion,
  changeFeeBase,
} from "./stored-service-price";
import { attachBookingPriceSnapshot } from "@/lib/charges/visit-line-items";

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

  it("charges the fee from the main service and one travel fee", () => {
    const source = readFileSync(
      new URL("./customer-change.ts", import.meta.url),
      "utf8",
    );
    const feeSource = readFileSync(
      new URL("./stored-service-price.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /changeFeeAmount\(action, base\.amount, band\)/);
    assert.equal(source.includes("changeQuoteEstimatedTotal"), false);
    assert.match(feeSource, /action === "remove_dog"/);
    assert.match(source, /needsPriceReview/);
  });

  it("keeps priced add-ons in the customer total and out of the fee base", () => {
    const guest = {
      estimated_total: 133,
      service_price: 90,
      travel_fee: 13,
      add_on_ids: ["mini-trim"],
      add_on_options: attachBookingPriceSnapshot(
        {},
        [{ id: "mini-trim", label: "Mini Trim", amount: 30 }],
        [],
      ),
    };
    assert.equal(changeFeeBase("cancel", [guest]).ok && changeFeeBase("cancel", [guest]).amount, 103);
    assert.equal(
      changeFeeBase("reschedule", [guest]).ok && changeFeeBase("reschedule", [guest]).amount,
      103,
    );
    assert.equal(
      changeFeeBase("remove_dog", [guest]).ok && changeFeeBase("remove_dog", [guest]).amount,
      90,
    );
    assert.equal(addressServicePortion(guest), 120);
    assert.equal(
      changeFeeBase("cancel", [
        {
          estimated_total: null,
          service_price: 90,
          travel_fee: 13,
          add_on_ids: [],
        },
      ]).amount,
      103,
    );
    assert.equal(
      addressServicePortion({
        estimated_total: null,
        service_price: 90,
        travel_fee: 13,
      }),
      90,
    );
    assert.equal(
      changeFeeBase("cancel", [
        {
          estimated_total: 170,
          service_price: 170,
          travel_fee: 13,
          add_on_ids: ["mini-trim"],
        },
      ]).ok,
      false,
    );
  });
});

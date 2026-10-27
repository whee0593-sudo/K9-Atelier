import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  changeFeeAmount,
  changeFeeWarning,
  changeNoticeBand,
  hoursUntilAppointment,
} from "./change-policy";
import {
  addressServicePortion,
  changeFeeBase,
} from "./stored-service-price";
import { attachBookingPriceSnapshot } from "@/lib/charges/visit-line-items";

describe("appointment change fees", () => {
  it("is complimentary two calendar days before the visit", () => {
    const now = new Date("2026-08-20T15:00:00.000Z");
    const band = changeNoticeBand("2026-08-24", 10 * 60, now);
    assert.equal(band, "complimentary");
    assert.equal(changeFeeAmount("cancel", 140, band), 0);
    assert.equal(changeFeeAmount("reschedule", 140, band), 0);
    assert.equal(changeFeeAmount("remove_dog", 140, band), 0);
  });

  it("charges 50% on the calendar day before the visit", () => {
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

  it("uses the New York calendar date, including across daylight saving time", () => {
    const appointment = "2026-10-23";
    const atThreePm = 15 * 60;
    const twoDaysBefore = changeNoticeBand(
      appointment,
      atThreePm,
      new Date("2026-10-21T20:00:00.000Z"),
    );
    assert.equal(twoDaysBefore, "complimentary");
    assert.ok(hoursUntilAppointment(appointment, atThreePm, new Date("2026-10-21T20:00:00.000Z")) < 48);

    const dayBeforeLate = changeNoticeBand(
      appointment,
      atThreePm,
      new Date("2026-10-23T03:00:00.000Z"),
    );
    assert.equal(dayBeforeLate, "late");
    assert.ok(hoursUntilAppointment(appointment, atThreePm, new Date("2026-10-23T03:00:00.000Z")) < 24);

    const morningOf = changeNoticeBand(
      appointment,
      atThreePm,
      new Date("2026-10-23T12:00:00.000Z"),
    );
    assert.equal(morningOf, "same_day");

    const springFree = changeNoticeBand(
      "2026-03-09",
      9 * 60,
      new Date("2026-03-08T04:30:00.000Z"),
    );
    const springLate = changeNoticeBand(
      "2026-03-09",
      9 * 60,
      new Date("2026-03-08T06:30:00.000Z"),
    );
    assert.equal(springFree, "complimentary");
    assert.equal(springLate, "late");

    const fallFree = changeNoticeBand(
      "2026-11-02",
      9 * 60,
      new Date("2026-11-01T03:00:00.000Z"),
    );
    const fallLate = changeNoticeBand(
      "2026-11-02",
      9 * 60,
      new Date("2026-11-01T06:30:00.000Z"),
    );
    assert.equal(fallFree, "complimentary");
    assert.equal(fallLate, "late");
  });

  it("charges the fee from confirmed services, priced add-ons, and one travel fee", () => {
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

  it("uses the saved confirmed total and leaves unquoted care out of the fee", () => {
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
    assert.equal(changeFeeBase("cancel", [guest]).ok && changeFeeBase("cancel", [guest]).amount, 133);
    assert.equal(
      changeFeeBase("reschedule", [guest]).ok && changeFeeBase("reschedule", [guest]).amount,
      133,
    );
    assert.equal(
      changeFeeBase("remove_dog", [guest]).ok && changeFeeBase("remove_dog", [guest]).amount,
      120,
    );
    const unquoted = {
      estimated_total: 103,
      service_price: 90,
      travel_fee: 13,
      add_on_ids: ["gentle-dematting"],
      add_on_options: attachBookingPriceSnapshot(
        {},
        [],
        [{ id: "gentle-dematting", label: "Gentle DeMatting", note: "Priced on site" }],
      ),
    };
    assert.equal(changeFeeBase("cancel", [unquoted]).ok && changeFeeBase("cancel", [unquoted]).amount, 103);
    const savedLines = {
      estimated_total: 160,
      service_price: 90,
      travel_fee: 0,
      add_on_ids: ["mini-trim", "gentle-dematting"],
      add_on_options: {
        __visitLineItems: [
          { id: "service", label: "Signature Bath", amount: 90, catalogId: "signature-bath-care" },
          { id: "trim", label: "Mini Trim", amount: 30, catalogId: "mini-trim" },
          { id: "mat", label: "Gentle DeMatting", amount: 0, catalogId: "gentle-dematting" },
          { id: "flea", label: "Flea treatment", amount: 25, catalogId: "flea-tick-fee" },
          { id: "travel", label: "Travel fee", amount: 13, catalogId: "travel-fee" },
        ],
      },
    };
    assert.equal(changeFeeBase("cancel", [savedLines]).ok && changeFeeBase("cancel", [savedLines]).amount, 158);
    assert.equal(
      changeFeeBase("remove_dog", [savedLines]).ok && changeFeeBase("remove_dog", [savedLines]).amount,
      145,
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

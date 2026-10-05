import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateTravelFee } from "./travel";

describe("calculateTravelFee", () => {
  it("charges the requested progressive amounts", () => {
    const cases: Array<[number, number, "complimentary" | "standard" | "extended" | "outside"]> = [
      [10, 0, "complimentary"],
      [12, 20, "standard"],
      [15, 50, "standard"],
      [16.7, 76, "standard"],
      [18, 95, "standard"],
      [20, 125, "standard"],
      [21, 145, "extended"],
      [22.6, 177, "extended"],
      [25, 225, "extended"],
      [25.1, 0, "outside"],
    ];

    for (const [miles, fee, zone] of cases) {
      const quote = calculateTravelFee(miles);
      assert.equal(quote.distanceMiles, miles, `${miles} mi distance`);
      assert.equal(quote.fee, fee, `${miles} mi fee`);
      assert.equal(quote.zone, zone, `${miles} mi zone`);
    }
  });

  it("keeps 21 miles progressive instead of charging every mile at $20", () => {
    const quote = calculateTravelFee(21);
    assert.equal(quote.fee, 50 + 75 + 20);
    assert.equal(quote.fee, 145);
    assert.notEqual(quote.fee, 21 * 20);
  });

  it("rounds 16.7 miles from $75.50 to $76 and keeps 22.6 miles at $177", () => {
    assert.equal(calculateTravelFee(16.7).fee, 76);
    assert.equal(calculateTravelFee(22.6).fee, 177);
  });

  it("treats distances that round to 10.0 miles as complimentary", () => {
    const quote = calculateTravelFee(10.04);
    assert.equal(quote.distanceMiles, 10);
    assert.equal(quote.fee, 0);
    assert.equal(quote.zone, "complimentary");
    assert.match(quote.summary, /Complimentary travel/);
  });

  it("does not offer a travel fee beyond 25.0 miles", () => {
    for (const miles of [25.05, 25.1, 30]) {
      const quote = calculateTravelFee(miles);
      assert.equal(quote.zone, "outside");
      assert.equal(quote.withinServiceArea, false);
      assert.equal(quote.fee, 0);
      assert.equal(
        quote.summary,
        "This address is outside our standard 25-mile service area. Please contact us to inquire about availability.",
      );
    }
    assert.equal(calculateTravelFee(25.05).distanceMiles, 25.1);
  });

  it("labels the extended band for the booking card", () => {
    const quote = calculateTravelFee(22.6);
    assert.match(quote.summary, /Extended Service Area/);
    assert.match(
      quote.summary,
      /An extended travel fee applies to this location/,
    );
    assert.match(quote.summary, /\$177/);
  });
});

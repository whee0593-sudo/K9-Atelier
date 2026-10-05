import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateTravelFee } from "./travel";

describe("calculateTravelFee", () => {
  it("treats 0 through 10.0 miles as complimentary", () => {
    for (const miles of [0, 5, 9.96, 10, 10.04]) {
      const quote = calculateTravelFee(miles);
      assert.equal(quote.zone, "complimentary");
      assert.equal(quote.fee, 0);
      assert.equal(quote.withinServiceArea, true);
      assert.equal(quote.withinFreeRadius, true);
      assert.match(quote.summary, /Complimentary travel/);
    }
    assert.equal(calculateTravelFee(10.04).distanceMiles, 10);
  });

  it("charges $6.50 per mile only for the portion above 10 through 20", () => {
    const fourteen = calculateTravelFee(14);
    assert.equal(fourteen.zone, "standard");
    assert.equal(fourteen.distanceMiles, 14);
    assert.equal(fourteen.billableMiles, 4);
    assert.equal(fourteen.fee, 26);

    const fifteen = calculateTravelFee(15);
    assert.equal(fifteen.fee, 33);
    assert.equal(fifteen.billableMiles, 5);

    const twenty = calculateTravelFee(20);
    assert.equal(twenty.zone, "standard");
    assert.equal(twenty.fee, 65);
    assert.equal(twenty.withinServiceArea, true);
  });

  it("uses a progressive extended rate above 20 miles through 25", () => {
    const justOver = calculateTravelFee(20.1);
    assert.equal(justOver.zone, "extended");
    assert.equal(justOver.fee, 66);

    const example = calculateTravelFee(21.8);
    assert.equal(example.distanceMiles, 21.8);
    assert.equal(example.billableMiles, 11.8);
    assert.equal(example.fee, 83);
    assert.equal(example.fee, 65 + 18);
    assert.notEqual(example.fee, Math.round(21.8 * 10));

    assert.equal(calculateTravelFee(23).fee, 95);
    assert.equal(calculateTravelFee(25).fee, 115);
    assert.equal(calculateTravelFee(25).zone, "extended");
    assert.equal(calculateTravelFee(25.04).distanceMiles, 25);
    assert.equal(calculateTravelFee(25.04).fee, 115);

    const extended = calculateTravelFee(21.8);
    assert.match(extended.summary, /Extended Service Area/);
    assert.match(
      extended.summary,
      /An extended travel fee applies to this location/,
    );
    assert.match(extended.summary, /\$83/);
  });

  it("does not offer a travel fee beyond 25.0 miles", () => {
    for (const miles of [25.05, 25.1, 30, 40]) {
      const quote = calculateTravelFee(miles);
      assert.equal(quote.zone, "outside");
      assert.equal(quote.withinServiceArea, false);
      assert.equal(quote.fee, 0);
      assert.equal(quote.billableMiles, 0);
      assert.equal(
        quote.summary,
        "This address is outside our standard 25-mile service area. Please contact us to inquire about availability.",
      );
    }
    assert.equal(calculateTravelFee(25.05).distanceMiles, 25.1);
  });
});

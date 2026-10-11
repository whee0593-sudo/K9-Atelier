import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { calculateTravelFee } from "./travel";

describe("calculateTravelFee", () => {
  it("charges the confirmed bands and rounds to the nearest dollar", () => {
    const cases: Array<
      [number, number, "complimentary" | "standard" | "extended" | "outside"]
    > = [
      [8, 0, "complimentary"],
      [10, 0, "complimentary"],
      [11, 7, "standard"],
      [15, 33, "standard"],
      [19.5, 62, "standard"],
      [20, 65, "standard"],
      [21, 75, "extended"],
      [21.8, 83, "extended"],
      [25, 115, "extended"],
      [25.1, 0, "outside"],
    ];

    for (const [miles, fee, zone] of cases) {
      const quote = calculateTravelFee(miles);
      assert.equal(quote.distanceMiles, miles, `${miles} mi distance`);
      assert.equal(quote.fee, fee, `${miles} mi fee`);
      assert.equal(quote.zone, zone, `${miles} mi zone`);
      assert.equal(quote.withinServiceArea, zone !== "outside", `${miles} mi bookable`);
    }
  });

  it("keeps 21 miles on the extended band instead of charging every mile at $10", () => {
    const quote = calculateTravelFee(21);
    assert.equal(quote.fee, 65 + 10);
    assert.equal(quote.fee, 75);
    assert.notEqual(quote.fee, 21 * 10);
  });

  it("rounds half-dollar amounts up and keeps 21.8 miles at $83", () => {
    assert.equal(calculateTravelFee(11).fee, 7);
    assert.equal(calculateTravelFee(15).fee, 33);
    assert.equal(calculateTravelFee(19.5).fee, 62);
    assert.equal(calculateTravelFee(21.8).fee, 83);
  });

  it("treats distances that round to 10.0 miles as complimentary", () => {
    const quote = calculateTravelFee(10.04);
    assert.equal(quote.distanceMiles, 10);
    assert.equal(quote.fee, 0);
    assert.equal(quote.zone, "complimentary");
    assert.match(quote.summary, /Complimentary travel/);
  });

  it("keeps exactly 20 and 25 miles inside the service area", () => {
    const at20 = calculateTravelFee(20);
    assert.equal(at20.zone, "standard");
    assert.equal(at20.fee, 65);
    assert.equal(at20.withinServiceArea, true);

    const at25 = calculateTravelFee(25);
    assert.equal(at25.zone, "extended");
    assert.equal(at25.fee, 115);
    assert.equal(at25.withinServiceArea, true);
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
    assert.equal(quote.fee, 91);
    assert.match(quote.summary, /Extended Service Area/);
    assert.match(
      quote.summary,
      /An extended travel fee applies to this location/,
    );
    assert.match(quote.summary, /\$91/);
  });

  it("is the only travel-fee formula used by booking entries", () => {
    const callers = [
      "src/app/api/travel-fee/route.ts",
      "src/lib/appointments/validation.ts",
      "src/lib/staff/create-customer-booking.ts",
      "src/lib/profiles/staff-addresses.ts",
    ];
    for (const file of callers) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      assert.match(source, /calculateTravelFee\(/);
    }

    const calculator = readFileSync(new URL("./travel.ts", import.meta.url), "utf8");
    assert.equal(calculator.includes("FIRST_CHARGE_PER_MILE"), false);
    assert.equal(calculator.includes("SECOND_CHARGE_PER_MILE"), false);
    assert.equal(calculator.includes("* 20"), false);
  });
});

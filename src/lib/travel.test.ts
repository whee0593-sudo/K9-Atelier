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

  it("judges 10, 20, and 25 mile boundaries on the raw distance", () => {
    const at10 = calculateTravelFee(10);
    assert.equal(at10.distanceMiles, 10);
    assert.equal(at10.fee, 0);
    assert.equal(at10.zone, "complimentary");

    const justOver10 = calculateTravelFee(10.04);
    assert.equal(justOver10.distanceMiles, 10.04);
    assert.equal(justOver10.zone, "standard");
    assert.equal(justOver10.fee, 0);
    assert.equal(justOver10.withinServiceArea, true);
    assert.doesNotMatch(justOver10.summary, /Complimentary travel/);

    assert.equal(calculateTravelFee(10.06).fee, 0);
    assert.equal(calculateTravelFee(10.06).zone, "standard");
    assert.equal(calculateTravelFee(10.08).fee, 1);

    const justUnder20 = calculateTravelFee(19.96);
    assert.equal(justUnder20.zone, "standard");
    assert.equal(justUnder20.fee, 65);

    const justOver20 = calculateTravelFee(20.04);
    assert.equal(justOver20.distanceMiles, 20.04);
    assert.equal(justOver20.zone, "extended");
    assert.equal(justOver20.fee, 65);
    assert.equal(justOver20.withinServiceArea, true);

    const justUnder25 = calculateTravelFee(24.96);
    assert.equal(justUnder25.zone, "extended");
    assert.equal(justUnder25.fee, 115);
    assert.equal(justUnder25.withinServiceArea, true);

    for (const miles of [25.01, 25.04, 25.05]) {
      const quote = calculateTravelFee(miles);
      assert.equal(quote.distanceMiles, miles, `${miles} stays unrounded`);
      assert.equal(quote.zone, "outside");
      assert.equal(quote.withinServiceArea, false);
      assert.equal(quote.fee, 0);
    }
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
    assert.equal(calculateTravelFee(25.05).distanceMiles, 25.05);
  });

  it("keeps the same fee when the quoted distance is submitted again", () => {
    for (const miles of [8, 10, 10.06, 11, 19.5, 20, 20.04, 21.8, 24.96, 25, 25.04]) {
      const first = calculateTravelFee(miles);
      const again = calculateTravelFee(first.distanceMiles);
      assert.equal(again.distanceMiles, miles);
      assert.equal(again.fee, first.fee);
      assert.equal(again.zone, first.zone);
      assert.equal(again.withinServiceArea, first.withinServiceArea);
    }
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
      "src/lib/booking-distance.ts",
      "src/lib/staff/create-customer-booking.ts",
      "src/lib/profiles/staff-addresses.ts",
    ];
    for (const file of callers) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      assert.match(source, /calculateTravelFee\(/);
    }
    const validation = readFileSync(
      new URL("./appointments/validation.ts", import.meta.url),
      "utf8",
    );
    assert.equal(validation.includes("calculateTravelFee("), false);

    const calculator = readFileSync(new URL("./travel.ts", import.meta.url), "utf8");
    assert.equal(calculator.includes("FIRST_CHARGE_PER_MILE"), false);
    assert.equal(calculator.includes("SECOND_CHARGE_PER_MILE"), false);
    assert.equal(calculator.includes("* 20"), false);
    assert.equal(calculator.includes("roundToTenth"), false);
  });
});

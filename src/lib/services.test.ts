import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getServiceById } from "./service-page";
import {
  getCoatTypePriceForPet,
  getServicePriceEstimate,
  getTierForPet,
  weightTierForPet,
} from "./services";

const FULL_GROOM_MATRIX = [
  ["under15", "short-light", 150],
  ["under15", "medium-standard", 165],
  ["under15", "long-full", 180],
  ["15to30", "short-light", 170],
  ["15to30", "medium-standard", 185],
  ["15to30", "long-full", 200],
  ["31to45", "short-light", 190],
  ["31to45", "medium-standard", 205],
  ["31to45", "long-full", 220],
] as const;

describe("weight tier boundaries", () => {
  it("keeps 15 lbs and 30 lbs in exactly one existing tier", () => {
    assert.equal(weightTierForPet(14.9), "under15");
    assert.equal(weightTierForPet(15), "under15");
    assert.equal(weightTierForPet(15.1), "15to30");
    assert.equal(weightTierForPet(30), "15to30");
    assert.equal(weightTierForPet(30.1), "31to45");
    assert.equal(weightTierForPet(31), "31to45");
    assert.equal(weightTierForPet(45), "31to45");
    assert.equal(weightTierForPet(45.1), "over45");
  });
});

describe("signature bath pricing", () => {
  it("stays weight-only at $90 / $110 / $130", () => {
    const bath = getServiceById("signature-bath-care");
    assert.ok(bath);
    assert.equal(getServicePriceEstimate(bath, 12)?.from, 90);
    assert.equal(getServicePriceEstimate(bath, 15)?.from, 90);
    assert.equal(getServicePriceEstimate(bath, 20)?.from, 110);
    assert.equal(getServicePriceEstimate(bath, 30)?.from, 110);
    assert.equal(getServicePriceEstimate(bath, 31)?.from, 130);
    assert.equal(getServicePriceEstimate(bath, 45)?.from, 130);
    assert.equal(bath.coatTypePrices, undefined);
  });
});

describe("full groom coat-type pricing", () => {
  it("resolves all nine weight × coat starting prices", () => {
    const groom = getServiceById("custom-full-haircut");
    assert.ok(groom);
    assert.equal(groom.coatTypePrices?.length, 9);

    for (const [weightTier, coatType, price] of FULL_GROOM_MATRIX) {
      const weightLbs =
        weightTier === "under15" ? 12 : weightTier === "15to30" ? 20 : 40;
      assert.equal(
        getCoatTypePriceForPet(groom, weightLbs, coatType),
        price,
        `${weightTier} ${coatType}`,
      );
      assert.equal(
        getServicePriceEstimate(groom, weightLbs, undefined, coatType)?.from,
        price,
      );
    }
  });

  it("does not guess Medium / Standard when coat type is missing", () => {
    const groom = getServiceById("custom-full-haircut");
    assert.ok(groom);
    assert.equal(getCoatTypePriceForPet(groom, 12), 150);
    assert.equal(getCoatTypePriceForPet(groom, 20), 170);
    assert.equal(getCoatTypePriceForPet(groom, 40), 190);
    assert.equal(getServicePriceEstimate(groom, 20)?.from, 170);
    assert.notEqual(getServicePriceEstimate(groom, 20)?.from, 185);
    assert.equal(getCoatTypePriceForPet(groom, 20, "not-a-coat"), null);
    assert.equal(
      getServicePriceEstimate(groom, 20, undefined, "not-a-coat"),
      null,
    );
  });

  it("no longer uses the old $150 / $190 / $230 weight-only groom prices", () => {
    const groom = getServiceById("custom-full-haircut");
    assert.ok(groom);
    assert.equal(getTierForPet(groom, 20)?.priceFrom, 170);
    assert.equal(getTierForPet(groom, 40)?.priceFrom, 190);
    assert.notEqual(getServicePriceEstimate(groom, 20)?.from, 190);
    assert.notEqual(getServicePriceEstimate(groom, 40)?.from, 230);
  });
});

describe("mini trim add-on pricing", () => {
  it("charges $30 / $35 / $40 by weight and shows $30+ publicly", () => {
    const mini = getServiceById("mini-trim");
    assert.ok(mini);
    assert.equal(mini.flatRate, 30);
    assert.equal(getServicePriceEstimate(mini, 12)?.from, 30);
    assert.equal(getServicePriceEstimate(mini, 15)?.from, 30);
    assert.equal(getServicePriceEstimate(mini, 20)?.from, 35);
    assert.equal(getServicePriceEstimate(mini, 30)?.from, 35);
    assert.equal(getServicePriceEstimate(mini, 40)?.from, 40);
    assert.notEqual(mini.flatRate, 50);
  });
});

describe("unchanged add-on prices", () => {
  it("keeps de-matting at $30 / 15 min and deshedding starting at $30", () => {
    const dematting = getServiceById("dematting-brush-out");
    const deshedding = getServiceById("deshedding-treatment");
    assert.ok(dematting);
    assert.ok(deshedding);
    assert.equal(dematting.flatRate, 30);
    assert.equal(dematting.durationMin, 15);
    assert.equal(getServicePriceEstimate(dematting, 20)?.from, 30);
    assert.equal(getServicePriceEstimate(deshedding, 12)?.from, 30);
    assert.equal(getServicePriceEstimate(deshedding, 20)?.from, 40);
    assert.equal(getServicePriceEstimate(deshedding, 40)?.from, 50);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPrice,
  getBrandSchemaTelephone,
  getServiceAreaFooterSentence,
} from "./business";

describe("formatPrice", () => {
  it("keeps whole-dollar starting prices without cents", () => {
    assert.equal(formatPrice(90), "$90");
    assert.equal(formatPrice(150), "$150");
  });

  it("shows two decimal places for fractional amounts", () => {
    assert.equal(formatPrice(6.5), "$6.50");
    assert.equal(formatPrice(182.5), "$182.50");
  });
});

describe("homepage business facts", () => {
  it("formats the public phone for schema.org", () => {
    assert.equal(getBrandSchemaTelephone(), "+1-561-593-3335");
  });

  it("lists homepage communities in Palm Beach order", () => {
    assert.equal(
      getServiceAreaFooterSentence(),
      "Serving Palm Beach, Jupiter, Palm Beach Gardens & West Palm Beach.",
    );
  });
});

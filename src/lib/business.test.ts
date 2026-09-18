import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bookingRequiresPaymentMethod, formatPrice, getPaymentFaqParagraphs } from "./business";

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

describe("payment method booking rule", () => {
  it("does not require a saved card to reserve", () => {
    assert.equal(bookingRequiresPaymentMethod(), false);
    const paragraphs = getPaymentFaqParagraphs().join(" ");
    assert.match(paragraphs, /optional/i);
    assert.equal(paragraphs.includes("required before you can reserve"), false);
  });
});

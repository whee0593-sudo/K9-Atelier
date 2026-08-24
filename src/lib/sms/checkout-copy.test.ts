import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCheckoutReadySms, petHomePronoun } from "./checkout-copy";

describe("checkout ready SMS", () => {
  it("uses her for a female pet", () => {
    assert.equal(petHomePronoun("Female, Spayed"), "her");
    assert.equal(
      buildCheckoutReadySms({ petName: "Maple", sex: "Female" }),
      [
        "K9 ATELIER: Maple is ready to come home! We’ll bring her to your door shortly. Thank you for trusting us with Maple’s care!",
        "",
        "Reply STOP to opt out.",
      ].join("\n"),
    );
  });

  it("uses him for a male pet", () => {
    assert.equal(petHomePronoun("Male, Neutered"), "him");
    assert.match(
      buildCheckoutReadySms({ petName: "Otto", sex: "Male" }),
      /bring him to your door/,
    );
  });

  it("uses them when sex is missing", () => {
    assert.equal(petHomePronoun(""), "them");
    assert.match(
      buildCheckoutReadySms({ petName: "Scout" }),
      /bring them to your door/,
    );
  });
});

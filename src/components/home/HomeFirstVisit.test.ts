import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homeFirstVisitSteps } from "@/components/home/home-first-visit";

describe("home first visit guide", () => {
  it("presents four booking steps in order", () => {
    assert.equal(homeFirstVisitSteps.length, 4);
    assert.deepEqual(
      homeFirstVisitSteps.map((step) => step.number),
      ["01", "02", "03", "04"],
    );
  });

  it("uses the approved vaccination-review wording", () => {
    const details = homeFirstVisitSteps[2];
    assert.equal(details.title, "Complete Your Details");
    assert.match(details.body, /vaccination record/);
    assert.match(details.body, /card on file/);
    assert.match(details.body, /If the record needs review/);
    assert.match(details.body, /when your appointment is confirmed/);
    assert.equal(details.body.includes("Should the record require review"), false);
    assert.equal(details.body.includes("COMPLETE YOUR BOOKING"), false);
  });

  it("keeps the arrival step private and at-home", () => {
    const arrival = homeFirstVisitSteps[3];
    assert.equal(arrival.title, "The Spa Arrives");
    assert.match(arrival.body, /private, one-on-one/);
    assert.match(arrival.body, /home/);
  });
});

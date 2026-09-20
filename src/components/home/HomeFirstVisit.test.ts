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

  it("uses rabies confirmation wording", () => {
    const details = homeFirstVisitSteps[0];
    assert.equal(details.title, "Tell Us About Your Dog");
    assert.match(details.body, /rabies vaccination status/);
    assert.match(details.body, /rabies certificate or vaccination record/);
    assert.equal(details.body.includes("If the record needs review"), false);
    assert.equal(details.body.includes("COMPLETE YOUR BOOKING"), false);
  });

  it("asks guests to add a few appointment-prep details", () => {
    const details = homeFirstVisitSteps[2];
    assert.equal(details.title, "Add a Few Details");
    assert.match(
      details.body,
      /Complete a few details to help us prepare for your appointment/,
    );
    assert.match(details.body, /not charged when you book/);
  });

  it("keeps the arrival step private and at-home", () => {
    const arrival = homeFirstVisitSteps[3];
    assert.equal(arrival.title, "The Spa Arrives");
    assert.match(arrival.body, /private, one-on-one/);
    assert.match(arrival.body, /home/);
  });
});

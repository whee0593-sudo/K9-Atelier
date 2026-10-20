import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  it("uses the first-visit welcome wording", () => {
    assert.deepEqual(
      homeFirstVisitSteps.map((step) => step.title),
      [
        "Your Dog",
        "Service & Time",
        "Your Details & Card",
        "The Spa Arrives",
      ],
    );
    assert.equal(
      homeFirstVisitSteps[0].body,
      "Add your dog’s name, breed and weight.",
    );
    assert.equal(
      homeFirstVisitSteps[1].body,
      "Select a service, then an available date and time.",
    );
    assert.equal(
      homeFirstVisitSteps[2].body,
      "Add your contact details and save a card. No charge today.",
    );
  });

  it("renders an em dash after each step number", () => {
    const source = readFileSync(new URL("./HomeFirstVisit.tsx", import.meta.url), "utf8");
    assert.match(source, /\{step\.number\} —/);
    assert.match(source, /text-\[12px\].*text-deep-lavender/);
    assert.match(source, /text-\[13px\] font-semibold uppercase/);
    assert.match(source, /min-h-\[52px\]/);
  });

  it("keeps the arrival step one-on-one and at the client’s home", () => {
    const arrival = homeFirstVisitSteps[3];
    assert.equal(arrival.title, "The Spa Arrives");
    assert.match(arrival.body, /Once confirmed/);
    assert.match(arrival.body, /come to you/);
    assert.match(arrival.body, /one-on-one grooming experience/);
  });
});

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
        "Who We’re Welcoming",
        "Choose Time & Service",
        "Add a Few Details",
        "The Spa Arrives",
      ],
    );
    assert.equal(
      homeFirstVisitSteps[0].body,
      "Tell us a little about your furry family.",
    );
    assert.equal(
      homeFirstVisitSteps[1].body,
      "Choose your preferred date, arrival window, and service.",
    );
    assert.equal(
      homeFirstVisitSteps[2].body,
      "Complete a few details to help us prepare for your visit.",
    );
  });

  it("renders an em dash after each step number", () => {
    const source = readFileSync(new URL("./HomeFirstVisit.tsx", import.meta.url), "utf8");
    assert.match(source, /\{step\.number\} —/);
  });

  it("keeps the arrival step one-on-one and at the client’s home", () => {
    const arrival = homeFirstVisitSteps[3];
    assert.equal(arrival.title, "The Spa Arrives");
    assert.match(arrival.body, /Once confirmed/);
    assert.match(arrival.body, /come to you/);
    assert.match(arrival.body, /one-on-one grooming experience/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import { RabiesStatusSummary } from "@/components/account/RabiesStatusSummary";
import type { PetProfile } from "@/lib/pets";

function pet(overrides: Partial<PetProfile> = {}): PetProfile {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Bella",
    breed: "Poodle",
    weightLbs: 12,
    vaccineRecordUploaded: false,
    vaccinationBookingStatus: "missing",
    rabiesStatus: null,
    ...overrides,
  };
}

describe("rabies profile UI", () => {
  it("asks customers to confirm rabies status with optional upload", () => {
    const html = renderToStaticMarkup(
      <PetProfileFieldsForm pet={pet()} onPetChange={() => undefined} />,
    );
    assert.match(html, /Rabies Vaccination/);
    assert.equal(html.includes("Florida law"), false);
    assert.match(html, /Current rabies vaccination/);
    assert.match(html, /Veterinarian-issued medical exemption/);
    assert.match(html, /Rabies Record/);
    assert.match(html, /PDF, JPG, PNG, WEBP, or HEIC/);
    assert.match(html, /Not uploaded/);
    assert.equal(html.includes("Add later"), false);
    assert.equal(html.includes("Needed before booking"), false);
    assert.equal(
      html.includes("Used for service pricing and eligibility"),
      false,
    );
    assert.equal(html.includes("Helps us prepare for a calm, safe visit"), false);
    assert.equal(
      html.includes("Include allergies, anxiety, joint issues"),
      false,
    );
    assert.match(html, /Nervous with dryers; prefers gentle handling/);
    assert.match(html, /Senior dog, arthritis; no hot dryer on legs/);
    assert.match(html, /Teddy bear face, 1 inch body length/);
  });

  it("does not show per-field helper notes in the booking form either", () => {
    const html = renderToStaticMarkup(
      <PetProfileFieldsForm
        pet={pet()}
        onPetChange={() => undefined}
        variant="booking"
      />,
    );
    assert.equal(
      html.includes("Used for service pricing and eligibility"),
      false,
    );
    assert.equal(html.includes("age-appropriate"), false);
    assert.equal(html.includes("Helps us prepare for a calm, safe visit"), false);
    assert.match(html, /Nervous with dryers; prefers gentle handling/);
  });

  it("shows confirmed current status and a missing record", () => {
    const html = renderToStaticMarkup(
      <RabiesStatusSummary pet={pet({ rabiesStatus: "current" })} />,
    );
    assert.match(html, /Rabies Vaccination/);
    assert.match(html, />Current</);
    assert.match(html, /Not uploaded/);
  });

  it("shows medical exemption and view document when a file exists", () => {
    const html = renderToStaticMarkup(
      <RabiesStatusSummary
        pet={pet({
          rabiesStatus: "medical_exemption",
          vaccineRecordUploaded: true,
        })}
      />,
    );
    assert.match(html, /Veterinary Medical Exemption/);
    assert.match(html, /View Document/);
  });
});

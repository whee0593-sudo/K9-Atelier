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
    assert.match(html, /Florida law/);
    assert.match(html, /Current rabies vaccination/);
    assert.match(html, /Veterinarian-issued medical exemption/);
    assert.match(html, /Rabies Record/);
    assert.match(html, /Optional/);
    assert.match(html, /rabies certificate or vaccination record/);
    assert.match(html, /Not uploaded/);
    assert.equal(html.includes("Add later"), false);
    assert.equal(html.includes("Needed before booking"), false);
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

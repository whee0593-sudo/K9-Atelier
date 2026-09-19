import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingExperienceStep } from "@/components/booking/BookingExperienceStep";
import { createDraftBookingPet } from "@/lib/booking-flow";

describe("BookingExperienceStep", () => {
  it("shows care categories with a plus, not the individual services", () => {
    const pet = { ...createDraftBookingPet(), name: "Bella", weightLbs: 12 };
    const html = renderToStaticMarkup(
      <BookingExperienceStep
        pet={pet}
        selectedServiceId={null}
        onSelect={() => {}}
        onContinue={() => {}}
        onBack={() => {}}
      />,
    );

    assert.match(html, /Bath, Show Care &amp; Spa/);
    assert.match(html, /Full Grooming &amp; Hand Stripping/);
    assert.match(html, /Creative Accent Color/);
    assert.match(html, />\+<\/span>/);
    assert.equal(html.includes("aria-expanded=\"true\""), false);
    assert.equal(html.includes("The Signature Bath"), false);
    assert.equal(html.includes("The Atelier Full Groom"), false);
    assert.equal(html.includes("Temporary Fun"), false);
    assert.equal(html.includes("Paws & Boots Accent"), false);
    assert.equal(html.includes("Add-On Care"), false);
    assert.equal(html.includes("End-of-Life Comfort Care"), false);
  });

  it("marks the category that holds the selected service", () => {
    const pet = { ...createDraftBookingPet(), name: "Bella", weightLbs: 12 };
    const html = renderToStaticMarkup(
      <BookingExperienceStep
        pet={pet}
        selectedServiceId="signature-bath-care"
        onSelect={() => {}}
        onContinue={() => {}}
        onBack={() => {}}
      />,
    );

    assert.match(html, /The Signature Bath selected/);
    assert.match(html, /Continue/);
    assert.equal(html.includes("From $90"), false);
  });
});

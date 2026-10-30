import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BookingExperienceStep,
  bookingCarePriceLabel,
} from "@/components/booking/BookingExperienceStep";
import { createDraftBookingPet } from "@/lib/booking-flow";
import { allBookableServices } from "@/lib/services";

describe("BookingExperienceStep", () => {
  it("embeds four shared categories without a second booking header or Continue button", () => {
    const html = renderToStaticMarkup(<BookingExperienceStep embedded membersOnlyAllowed
      pet={{...createDraftBookingPet(),name:"Yoyo",weightLbs:9}}
      selectedServiceId="signature-bath-care" selectedIds={["signature-bath-care","senior-comfort-care"]}
      onSelect={() => {}} onContinue={() => {}} onBack={() => {}} />);
    assert.equal((html.match(/aria-expanded="false"/g) ?? []).length,4);
    assert.match(html,/Specialty Add-on Care/);
    assert.match(html,/Signature Bath selected/);
    assert.match(html,/Extra-Gentle Senior Care selected/);
    assert.equal(html.includes("Choose a Grooming Service"),false);
    assert.equal(html.includes("Continue"),false);
  });
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

    assert.match(html, /Bath, Coat Care &amp; Spa/);
    assert.match(html, /Full Grooming &amp; Hand Stripping/);
    assert.match(html, /Creative Accent Color/);
    assert.match(html, />\+<\/span>/);
    assert.equal(html.includes("aria-expanded=\"true\""), false);
    assert.equal(html.includes("The Signature Bath"), false);
    assert.equal(html.includes("The Atelier Full Groom"), false);
    assert.equal(html.includes("Temporary Fun"), false);
    assert.equal(html.includes("Paws & Boots Accent"), false);
    assert.equal(html.includes("Dead Sea Mineral Ritual"), false);
    assert.equal(html.includes(">Spa<"), false);
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

    assert.match(html, /Signature Bath selected/);
    assert.match(html, /Continue/);
    assert.equal(html.includes("From $90"), false);
  });

  it("labels hand stripping as an hourly starting rate", () => {
    const stripping = allBookableServices().find(
      (service) => service.id === "hand-stripping",
    );
    const bath = allBookableServices().find(
      (service) => service.id === "signature-bath-care",
    );
    assert.ok(stripping);
    assert.ok(bath);
    assert.equal(bookingCarePriceLabel(stripping, 160), "From $160/hour");
    assert.equal(bookingCarePriceLabel(bath, 90), "From $90");
  });
});

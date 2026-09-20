import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingDetailsStep } from "@/components/booking/BookingDetailsStep";
import { createDraftBookingPet } from "@/lib/booking-flow";

describe("BookingDetailsStep", () => {
  it("uses the appointment-prep heading and optional note fields", () => {
    const pet = {
      ...createDraftBookingPet(),
      name: "Bella",
      temperament: "Prefers a quiet van",
    };
    const html = renderToStaticMarkup(
      <BookingDetailsStep
        pet={pet}
        parkingNotes="Gate code 1234"
        onPetChange={() => {}}
        onParkingNotesChange={() => {}}
        onContinue={() => {}}
        onBack={() => {}}
      />,
    );

    assert.match(html, /03 — Add a Few Details/);
    assert.match(
      html,
      /Complete a few details to help us prepare for your appointment/,
    );
    assert.match(html, /Temperament &amp; Handling Notes/);
    assert.match(html, /Health &amp; Comfort Notes/);
    assert.match(html, /Grooming Preferences/);
    assert.match(html, /Parking \/ Access Notes/);
    assert.match(html, /Prefers a quiet van/);
    assert.match(html, /Gate code 1234/);
    assert.match(html, /Continue/);
    assert.equal(html.includes("Rabies Status"), false);
    assert.equal(html.includes("Who Are We Welcoming"), false);
  });
});

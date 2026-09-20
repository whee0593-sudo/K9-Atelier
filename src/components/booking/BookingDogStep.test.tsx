import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingDogStep } from "@/components/booking/BookingDogStep";
import { createDraftBookingPet } from "@/lib/booking-flow";

describe("BookingDogStep", () => {
  it("keeps identity fields and leaves prep notes for step 03", () => {
    const html = renderToStaticMarkup(
      <BookingDogStep
        draftPet={{ ...createDraftBookingPet(), name: "Bella" }}
        onDraftChange={() => {}}
        onContinue={() => {}}
      />,
    );

    assert.match(html, /Who Are We Welcoming/);
    assert.match(html, /Pet Name/);
    assert.match(html, /Rabies Status/);
    assert.equal(html.includes("Temperament"), false);
    assert.equal(html.includes("Health &amp; Comfort Notes"), false);
    assert.equal(html.includes("Grooming Preferences"), false);
    assert.equal(html.includes("Parking / Access Notes"), false);
  });
});

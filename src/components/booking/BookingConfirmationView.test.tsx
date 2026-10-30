import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingConfirmationView } from "./BookingReviewStep";
import { createDraftBookingPet } from "@/lib/booking-flow";

(globalThis as { React?: typeof React }).React = React;
const props = {
  pet: { ...createDraftBookingPet(), name: "LYCHEE" },
  serviceName: "Custom Full Haircut & Styling",
  appointmentDate: "2026-10-30",
  appointmentTime: "9:00–11:38 AM",
  address: { street: "100 Example Avenue", city: "Jupiter", state: "FL", zip: "33458" },
};

describe("booking success presentation", () => {
  it("renders separate dog service rows and a US date with the labeled timeframe", () => {
    const html = renderToStaticMarkup(<BookingConfirmationView {...props}
      additionalPetNames={["BELLA"]}
      dogServices={[{petName:"LYCHEE",serviceName:props.serviceName},{petName:"BELLA",serviceName:"Hand Stripping"}]} />);
    assert.match(html, /data-booking-confirmed/);
    assert.equal(html.includes("Your Appointment Is Confirmed"), false);
    assert.match(html, /10\/30\/2026/);
    assert.match(html, /Estimated Time Frame/);
    assert.match(html, /whitespace-nowrap">9:00–11:38 AM/);
    assert.match(html, /text-right">Hand Stripping/);
    assert.match(html, /Have a special note\?/);
    assert.match(html, /href="\/contact"[^>]*>Contact Us/);
    assert.match(html, /href="\/account\/bookings"/);
    assert.match(html, /Return Home/);
  });
  it("keeps the service attached to the single pet", () => {
    const html = renderToStaticMarkup(<BookingConfirmationView {...props} />);
    assert.match(html, /LYCHEE/);
    assert.match(html, /Custom Full Haircut &amp; Styling/);
  });
  it("continues to distinguish a pending appointment from a confirmed one", () => {
    const html = renderToStaticMarkup(<BookingConfirmationView {...props} appointmentStatus="pending_confirmation" />);
    assert.match(html, /Appointment Received/);
    assert.match(html, /pending confirmation/);
    assert.equal(html.includes("Your appointment is reserved"), false);
  });
});

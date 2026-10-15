import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingConfirmStep } from "@/components/booking/BookingConfirmStep";
import { BookingPriceSummaryStep } from "@/components/booking/BookingPriceSummaryStep";
import { createDraftBookingPet } from "@/lib/booking-flow";
import {
  BOOKING_PRICE_DISCLAIMER,
  FULL_GROOM_ESTIMATE_NOTE,
  HAND_STRIPPING_ESTIMATE_NOTE,
} from "@/lib/booking-price";
import { allBookableServices } from "@/lib/services";
import type { TravelQuote } from "@/lib/travel";

function service(id: string) {
  const found = allBookableServices().find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

function pet(weightLbs: number) {
  return {
    ...createDraftBookingPet(),
    name: "Bella",
    breed: "Poodle",
    weightLbs,
  };
}

describe("booking price summary", () => {
  it("shows the catalog total before a card is saved", () => {
    const html = renderToStaticMarkup(
      <BookingPriceSummaryStep
        pet={pet(12)}
        service={service("signature-bath-care")}
        addOnIds={[]}
        addOnOptions={{}}
        distanceMiles={4}
        onBack={() => {}}
        onContinue={() => {}}
      />,
    );
    assert.match(html, /Selected Service/);
    assert.match(html, /The Signature Bath/);
    assert.match(html, /Estimated Service Price/);
    assert.match(html, /From \$90/);
    assert.match(html, /Add-On Care/);
    assert.match(html, /None/);
    assert.match(html, /Travel Fee/);
    assert.match(html, /Complimentary/);
    assert.match(html, /Estimated Total/);
    assert.match(html, /From \$90/);
    assert.equal(html.includes("Confirm Appointment"), false);
  });

  it("changes the total when the service or travel distance changes", () => {
    const bath = renderToStaticMarkup(
      <BookingPriceSummaryStep
        pet={pet(12)}
        service={service("signature-bath-care")}
        addOnIds={[]}
        addOnOptions={{}}
        distanceMiles={4}
        onBack={() => {}}
        onContinue={() => {}}
      />,
    );
    const groom = renderToStaticMarkup(
      <BookingPriceSummaryStep
        pet={pet(12)}
        service={service("custom-full-haircut")}
        addOnIds={[]}
        addOnOptions={{}}
        distanceMiles={4}
        onBack={() => {}}
        onContinue={() => {}}
      />,
    );
    const withTravel = renderToStaticMarkup(
      <BookingPriceSummaryStep
        pet={pet(12)}
        service={service("signature-bath-care")}
        addOnIds={[]}
        addOnOptions={{}}
        distanceMiles={12}
        onBack={() => {}}
        onContinue={() => {}}
      />,
    );
    assert.match(bath, /From \$90/);
    assert.match(groom, /From \$140/);
    assert.match(groom, new RegExp(FULL_GROOM_ESTIMATE_NOTE));
    assert.match(withTravel, /\$13/);
    assert.match(withTravel, /From \$103/);
    assert.equal(bath.includes("$13"), false);
  });

  it("explains the hand stripping hourly estimate", () => {
    const html = renderToStaticMarkup(
      <BookingPriceSummaryStep
        pet={pet(50)}
        service={service("hand-stripping")}
        addOnIds={[]}
        addOnOptions={{}}
        distanceMiles={4}
        onBack={() => {}}
        onContinue={() => {}}
      />,
    );
    assert.match(html, /\$160\/hr/);
    assert.match(html, new RegExp(HAND_STRIPPING_ESTIMATE_NOTE));
    assert.match(html, />\$160</);
  });
});

describe("booking confirm step", () => {
  const address = {
    street: "100 Olive Ave",
    city: "West Palm Beach",
    state: "FL",
    zip: "33401",
  };
  const travel = {
    distanceMiles: 4,
    freeMiles: 10,
    billableMiles: 0,
    fee: 0,
    withinServiceArea: true,
    withinFreeRadius: true,
    zone: "complimentary",
    summary: "Complimentary travel",
    lat: 26.7,
    lon: -80.05,
  } satisfies TravelQuote;

  function confirm(serviceId: string, weightLbs: number, distanceMiles = 4) {
    return renderToStaticMarkup(
      <BookingConfirmStep
        pet={pet(weightLbs)}
        service={service(serviceId)}
        addOnIds={[]}
        addOnOptions={{}}
        address={address}
        travelQuote={{ ...travel, distanceMiles }}
        appointmentDate="2026-10-20"
        appointmentTime="10:00–11:00 AM"
        slotStartMinutes={600}
        owner={{
          firstName: "Tia",
          lastName: "Francavilla",
          email: "tia@example.com",
          phone: "5613466778",
          smsConsent: false,
          photoMarketingConsent: false,
          servicePoliciesConsent: false,
        }}
        paymentMethod={{
          id: "22222222-2222-4222-8222-222222222222",
          brand: "visa",
          last4: "4242",
          expMonth: 12,
          expYear: 2030,
          isDefault: true,
        }}
        onBack={() => {}}
        onReserved={() => {}}
      />,
    );
  }

  it("matches the price summary and keeps a single confirm button", () => {
    const summary = renderToStaticMarkup(
      <BookingPriceSummaryStep
        pet={pet(12)}
        service={service("signature-bath-care")}
        addOnIds={[]}
        addOnOptions={{}}
        distanceMiles={12}
        onBack={() => {}}
        onContinue={() => {}}
      />,
    );
    const html = confirm("signature-bath-care", 12, 12);
    assert.match(html, /Customer/);
    assert.match(html, /Tia Francavilla/);
    assert.match(html, /Pet/);
    assert.match(html, /Bella/);
    assert.match(html, /Selected Service/);
    assert.match(html, /The Signature Bath/);
    assert.match(html, /Add-On Care/);
    assert.match(html, /Appointment Date/);
    assert.match(html, /October 20, 2026/);
    assert.match(html, /Arrival Window/);
    assert.match(html, /10:00–11:00 AM/);
    assert.match(html, /Estimated Service Price/);
    assert.match(html, /Travel Fee/);
    assert.match(html, /\$13/);
    assert.match(html, /Estimated Total/);
    assert.match(html, /From \$103/);
    assert.match(summary, /From \$103/);
    assert.match(html, new RegExp(BOOKING_PRICE_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /Confirm Appointment/);
    assert.equal(html.includes("Reserve Appointment"), false);
  });

  it("uses the full groom and hand stripping estimate wording", () => {
    const groom = confirm("custom-full-haircut", 12);
    const stripping = confirm("hand-stripping", 50);
    assert.match(groom, /From \$140/);
    assert.match(groom, new RegExp(FULL_GROOM_ESTIMATE_NOTE));
    assert.match(stripping, /\$160\/hr/);
    assert.match(stripping, new RegExp(HAND_STRIPPING_ESTIMATE_NOTE));
  });
});

describe("booking flow wiring", () => {
  it("shows the price summary before payment and does not mount the old review step", () => {
    const source = readFileSync(
      new URL("./BookingFlow.tsx", import.meta.url),
      "utf8",
    );
    const summaryAt = source.indexOf("<BookingPriceSummaryStep");
    const paymentAt = source.indexOf("<BookingPaymentStep");
    const confirmAt = source.indexOf("<BookingConfirmStep");
    assert.ok(summaryAt > 0);
    assert.ok(summaryAt < paymentAt);
    assert.ok(paymentAt < confirmAt);
    assert.equal(source.includes("<BookingReviewStep"), false);
    assert.match(source, /BookingConfirmationView/);
  });
});

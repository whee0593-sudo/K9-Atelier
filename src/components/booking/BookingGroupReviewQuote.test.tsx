import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingGroupReviewQuote } from "./BookingGroupReviewQuote";
import { BookingGroupConfirmStep } from "./BookingGroupConfirmStep";
import { createDraftBookingPet } from "@/lib/booking-flow";
import { quoteGuestBooking, FULL_GROOM_ESTIMATE_NOTE } from "@/lib/booking-price";
import { allBookableServices } from "@/lib/services";
import type { BookingDogService } from "@/lib/booking/dogs";

(globalThis as { React?: typeof React }).React = React;
const service = allBookableServices().find(s => s.id === "signature-bath-care")!;
const dogs: BookingDogService[] = ["Lychee", "Mochi", "Bella"].map((name, i) => ({
  pet: { ...createDraftBookingPet(), id: `dog-${i}`, name, breed: "Shih Tzu", weightLbs: 10 },
  service, addOnIds: [], addOnOptions: {}, spaGoals: [],
}));
const result = quoteGuestBooking({ serviceId: service.id, weightLbs: 10, addOnIds: [], addOnOptions: {}, distanceMiles: 0 });
if (!result.ok) throw new Error("Invalid quote fixture");
const first = { ...result.quote, serviceName: "Custom Full Haircut & Styling", servicePrice: 140,
  servicePriceLabel: "$140", estimateNote: FULL_GROOM_ESTIMATE_NOTE,
  addOns: [{ id: "color", name: "Creative Accent Coloring — Temporary Fun", price: 50, priceLabel: "$50" }],
  estimatedTotal: 190 };
const second = { ...result.quote, servicePrice: 90, estimatedTotal: 90 };

describe("shared multi-dog review summary", () => {
  it("groups each dog's services before the next dog and shows one combined total and notice", () => {
    const html = renderToStaticMarkup(<BookingGroupReviewQuote dogs={dogs.slice(0, 2)} quotes={[first, second]} />);
    assert.ok(html.indexOf("Lychee") < html.indexOf("Creative Accent Coloring"));
    assert.ok(html.indexOf("Creative Accent Coloring") < html.indexOf("Mochi"));
    assert.ok(html.indexOf("Mochi") < html.indexOf("Estimated Total"));
    assert.match(html, /\$280\.00/);
    assert.equal((html.match(/Estimated Total/g) ?? []).length, 1);
    assert.equal((html.match(/Pricing Notice/g) ?? []).length, 1);
    assert.ok(html.indexOf("Pricing Notice") > html.lastIndexOf("$280.00"));
    assert.equal(html.includes("Travel Fee"), false);
    assert.equal(html.includes("This estimate reflects"), false);
    assert.equal(html.includes("Your estimated total is based"), false);
    assert.match(html, /Final pricing may vary depending on coat condition/);
  });
  it("keeps a positive travel fee once and includes all three dogs in the total", () => {
    const html = renderToStaticMarkup(<BookingGroupReviewQuote dogs={dogs} quotes={[{ ...first, travelFee: 13.25, estimatedTotal: 203.25 }, second, second]} />);
    assert.equal((html.match(/Travel Fee/g) ?? []).length, 1);
    assert.match(html, /\$13\.25/);
    assert.match(html, /\$383\.25/);
    assert.match(html, /Bella/);
  });
  it("does not show a misleading partial total when a quote is missing", () => {
    const html = renderToStaticMarkup(<BookingGroupReviewQuote dogs={dogs.slice(0, 2)} quotes={[first, null]} />);
    assert.match(html, /role="alert"/);
    assert.equal(html.includes("Estimated Total"), false);
  });
  it("preserves hourly pricing and assessed-service disclosures", () => {
    const quote = { ...first, pricingBasis: "hourly" as const,
      assessedAddOns: [{ id: "care", name: "Additional Care", note: "Assessed by your groomer." }],
      assessmentExclusionNote: "Assessed care is excluded from this estimate." };
    const html = renderToStaticMarkup(<BookingGroupReviewQuote dogs={dogs.slice(0, 2)} quotes={[quote, second]} />);
    assert.match(html, /\$140\.00\/hour/);
    assert.match(html, /Assessed by your groomer/);
    assert.match(html, /Assessed care is excluded/);
  });
  it("removes the multi-dog subtitle from the confirmation page", () => {
    const html = renderToStaticMarkup(<BookingGroupConfirmStep dogs={dogs.slice(0, 2)}
      address={{street:"100 Example Ave", city:"Jupiter",state:"FL",zip:"33458"}}
      travelQuote={{distanceMiles:0,freeMiles:10,billableMiles:0,fee:0,withinServiceArea:true,withinFreeRadius:true,zone:"complimentary",summary:"Within service area",lat:26.9,lon:-80.1}}
      appointmentDate="2026-11-10" appointmentTime="9:00 AM" slotStartMinutes={540}
      owner={{firstName:"Demo",lastName:"Owner",email:"demo@example.com",phone:"5615550123",smsConsent:false,photoMarketingConsent:false,servicePoliciesConsent:true,householdAllergyStatus:null,householdAllergyDetails:""}}
      paymentMethod={{id:"demo-card",brand:"visa",last4:"4242",expMonth:12,expYear:2030,isDefault:true}}
      idempotencyKey="demo" onBack={()=>{}} onDogsSaved={()=>{}} onReserved={()=>{}} />);
    assert.equal(html.includes("One visit for"), false);
    assert.equal(html.includes("Estimated visit total"), false);
    assert.equal((html.match(/Estimated Total/g) ?? []).length, 1);
  });
});

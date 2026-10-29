import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;
import { BookingCareOptionsStep } from "@/components/booking/BookingCareOptionsStep";
import { BookingConfirmStep } from "@/components/booking/BookingConfirmStep";
import { BookingReviewQuote } from "@/components/booking/BookingReviewQuote";
import { ServiceAreaRates } from "@/components/service-area/ServiceAreaRates";
import { FeesPoliciesSection } from "@/components/services/FeesPoliciesSection";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ServicePriceDetails } from "@/components/services/ServicePriceDetails";
import { ServiceDirectory } from "@/components/services/ServiceDirectory";
import { createDraftBookingPet } from "@/lib/booking-flow";
import {
  BOOKING_PRICE_DISCLAIMER,
  bookingTravelAreaCopy,
  evaluateSubmittedBookingPrice,
  formatReviewMoney,
  quoteGuestBooking,
} from "@/lib/booking-price";
import { catalogChargeGroups } from "@/lib/charges/catalog";
import { buildDefaultLineItems, sanitizeLineItems } from "@/lib/charges/line-items";
import { buildVisitBill } from "@/lib/charges/visit-bill";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  containsDisplayedServicePrice,
  servicePricesVisibleToViewer,
} from "@/lib/pricing-access";
import { getServiceById, serviceCardPriceValue } from "@/lib/service-page";
import {
  DESHEDDING_ADD_ON_ID,
  DESHEDDING_ALREADY_INCLUDED_MESSAGE,
  GENTLE_DEMATTING_ASSESSMENT_NOTE,
  GENTLE_DEMATTING_EXCLUSION_NOTE,
  GENTLE_DEMATTING_ID,
  GENTLE_DEMATTING_INTERNAL_START,
  MINI_TRIM_ADD_ON_ID,
  MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
  SENIOR_CARE_ADD_ON_ID,
  addOnAvailability,
  addOnSelectionMessage,
  estimateServiceDurationMinutes,
  getAvailableAddOns,
  getServicePriceEstimate,
  resolveAddOnCharges,
} from "@/lib/services";
import type { TravelQuote } from "@/lib/travel";
import { readFileSync } from "node:fs";

const PRIMARIES = [
  "signature-bath-care",
  "show-level-coat-care",
  "luxury-spa-day",
  "custom-full-haircut",
  "hand-stripping",
] as const;

const MATRIX: Record<string, Record<string, "selectable" | "included" | "unavailable">> = {
  "signature-bath-care": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "selectable",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    [MINI_TRIM_ADD_ON_ID]: "selectable",
  },
  "show-level-coat-care": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "selectable",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    [MINI_TRIM_ADD_ON_ID]: "included",
  },
  "luxury-spa-day": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "included",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    [MINI_TRIM_ADD_ON_ID]: "included",
  },
  "custom-full-haircut": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "selectable",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    [MINI_TRIM_ADD_ON_ID]: "included",
  },
  "hand-stripping": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "unavailable",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    [MINI_TRIM_ADD_ON_ID]: "unavailable",
  },
};

function appointment(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: "apt-1",
    customerId: "cust-1",
    petId: "pet-1",
    petName: "Maple",
    petBreed: "Cavapoo",
    serviceId: "signature-bath-care",
    serviceName: "Signature Bath",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "123 Example Avenue",
    addressCity: "Palm Beach Gardens",
    addressState: "FL",
    addressZip: "33418",
    travelDistanceMiles: 4,
    travelFee: 0,
    appointmentDate: "2026-10-24",
    appointmentTime: "10:00–11:00 AM",
    scheduledStart: 600,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: 90,
    newClientDeposit: 0,
    vaccinationStatusAtBooking: null,
    status: "confirmed",
    confirmedAt: null,
    customerConfirmedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...patch,
  };
}

function pet(weightLbs: number) {
  return {
    ...createDraftBookingPet(),
    name: "Bella",
    breed: "Poodle",
    weightLbs,
  };
}

describe("add-on compatibility matrix", () => {
  it("matches the confirmed primary and add-on pairs", () => {
    for (const primary of PRIMARIES) {
      for (const [addOn, expected] of Object.entries(MATRIX[primary])) {
        assert.equal(addOnAvailability(primary, addOn), expected, `${primary} ${addOn}`);
      }
      const offered = new Set(
        getAvailableAddOns("bath-show-spa", primary).map((service) => service.id),
      );
      for (const [addOn, expected] of Object.entries(MATRIX[primary])) {
        assert.equal(offered.has(addOn), expected === "selectable", `${primary} offers ${addOn}`);
      }
    }
    assert.equal(addOnAvailability("end-of-life-care", MINI_TRIM_ADD_ON_ID), "unavailable");
    assert.equal(
      getServiceById("creative-accent-coloring")?.categoryId,
      "creative-accent-coloring",
    );
  });

  it("allows Hand Stripping with Gentle DeMatting and Senior Care, and rejects DeShedding", () => {
    const dematting = quoteGuestBooking({
      serviceId: "hand-stripping",
      weightLbs: 20,
      addOnIds: [GENTLE_DEMATTING_ID],
      addOnOptions: {},
      distanceMiles: 4,
    });
    const senior = quoteGuestBooking({
      serviceId: "hand-stripping",
      weightLbs: 20,
      addOnIds: [SENIOR_CARE_ADD_ON_ID],
      addOnOptions: {},
      distanceMiles: 4,
    });
    const shedding = quoteGuestBooking({
      serviceId: "hand-stripping",
      weightLbs: 20,
      addOnIds: [DESHEDDING_ADD_ON_ID],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(dematting.ok, true);
    assert.equal(senior.ok, true);
    assert.equal(shedding.ok, false);
    if (!shedding.ok) {
      assert.equal(shedding.code, "invalid_addon");
      assert.match(shedding.message, /cannot be booked/);
    }
    assert.equal(
      addOnSelectionMessage(["hand-stripping"], [DESHEDDING_ADD_ON_ID]),
      "That add-on cannot be booked with this service.",
    );
  });

  it("does not charge DeShedding again on Luxury Spa Day or Mini Trim when it is included", () => {
    const spa = quoteGuestBooking({
      serviceId: "luxury-spa-day",
      weightLbs: 12,
      addOnIds: [DESHEDDING_ADD_ON_ID],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(spa.ok, true);
    if (spa.ok) assert.equal(spa.quote.addOnPrice, 0);
    assert.equal(
      addOnSelectionMessage(["luxury-spa-day"], [DESHEDDING_ADD_ON_ID]),
      DESHEDDING_ALREADY_INCLUDED_MESSAGE,
    );
    for (const serviceId of ["show-level-coat-care", "luxury-spa-day", "custom-full-haircut"]) {
      const quoted = quoteGuestBooking({
        serviceId,
        weightLbs: 12,
        addOnIds: [MINI_TRIM_ADD_ON_ID],
        addOnOptions: {},
        distanceMiles: 4,
      });
      assert.equal(quoted.ok, true, serviceId);
      if (quoted.ok) assert.equal(quoted.quote.addOnPrice, 0, serviceId);
      assert.equal(
        addOnSelectionMessage([serviceId], [MINI_TRIM_ADD_ON_ID]),
        MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
      );
    }
  });
});

describe("phase 2 prices", () => {
  it("prices Mini Trim at $30 for every weight and keeps weight tiers for the other add-ons", () => {
    const mini = getServiceById(MINI_TRIM_ADD_ON_ID);
    const shedding = getServiceById(DESHEDDING_ADD_ON_ID);
    const senior = getServiceById(SENIOR_CARE_ADD_ON_ID);
    assert.ok(mini && shedding && senior);
    for (const weight of [10, 15, 16, 30, 31, 45]) {
      assert.equal(getServicePriceEstimate(mini, weight)?.from, 30);
    }
    for (const [weight, price] of [
      [12, 30],
      [20, 40],
      [40, 50],
    ] as const) {
      assert.equal(getServicePriceEstimate(shedding, weight)?.from, price);
      assert.equal(getServicePriceEstimate(senior, weight)?.from, price);
    }
    const bath = quoteGuestBooking({
      serviceId: "signature-bath-care",
      weightLbs: 40,
      addOnIds: [MINI_TRIM_ADD_ON_ID, DESHEDDING_ADD_ON_ID, SENIOR_CARE_ADD_ON_ID],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(bath.ok, true);
    if (!bath.ok) return;
    assert.deepEqual(
      bath.quote.addOns.map((item) => [item.id, item.price]),
      [
        [MINI_TRIM_ADD_ON_ID, 30],
        [DESHEDDING_ADD_ON_ID, 50],
        [SENIOR_CARE_ADD_ON_ID, 50],
      ],
    );
  });

  it("keeps unquoted Gentle DeMatting out of the estimated total", () => {
    const quoted = quoteGuestBooking({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: [GENTLE_DEMATTING_ID],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(quoted.ok, true);
    if (!quoted.ok) return;
    assert.equal(quoted.quote.servicePrice, 90);
    assert.equal(quoted.quote.addOnPrice, 0);
    assert.equal(quoted.quote.estimatedTotal, 90);
    assert.equal(quoted.quote.assessedAddOns[0]?.name, "Gentle DeMatting");
    assert.equal(quoted.quote.assessedAddOns[0]?.note, GENTLE_DEMATTING_ASSESSMENT_NOTE);
    assert.equal(quoted.quote.assessmentExclusionNote, GENTLE_DEMATTING_EXCLUSION_NOTE);
    const text = [
      quoted.quote.addOnLabel,
      quoted.quote.assessedAddOns[0]?.note ?? "",
      quoted.quote.assessmentExclusionNote ?? "",
      quoted.quote.totalLabel,
    ].join(" ");
    assert.equal(text.includes("$0"), false);
    assert.equal(/complimentary|free/i.test(text), false);
    assert.equal(GENTLE_DEMATTING_INTERNAL_START.amount, 30);

    const accepted = evaluateSubmittedBookingPrice(
      {
        serviceId: "signature-bath-care",
        addOnIds: [GENTLE_DEMATTING_ID],
        addOnOptions: {},
        distanceMiles: 4,
        estimatedTotal: 90,
      },
      12,
    );
    const invented = evaluateSubmittedBookingPrice(
      {
        serviceId: "signature-bath-care",
        addOnIds: [GENTLE_DEMATTING_ID],
        addOnOptions: {},
        distanceMiles: 4,
        estimatedTotal: 0,
      },
      12,
    );
    assert.equal(accepted.ok, true);
    assert.equal(invented.ok, false);
    if (!invented.ok) assert.equal(invented.quote?.estimatedTotal, 90);
  });

  it("does not extend the appointment for schedule-neutral add-ons", () => {
    const base = estimateServiceDurationMinutes("signature-bath-care", 12);
    const withAddOns = estimateServiceDurationMinutes("signature-bath-care", 12, [
      GENTLE_DEMATTING_ID,
      DESHEDDING_ADD_ON_ID,
      SENIOR_CARE_ADD_ON_ID,
      MINI_TRIM_ADD_ON_ID,
    ]);
    assert.equal(withAddOns, base);
  });
});

describe("service price visibility", () => {
  it("ignores a forged client admin flag", () => {
    assert.equal(
      servicePricesVisibleToViewer({ serverStaff: false, clientClaimsAdmin: true }),
      false,
    );
    assert.equal(
      servicePricesVisibleToViewer({ serverStaff: true, clientClaimsAdmin: false }),
      true,
    );
  });

  it("hides catalog prices from guests and shows them to a verified admin", () => {
    const bath = getServiceById("signature-bath-care");
    assert.ok(bath);
    const guest = renderToStaticMarkup(
      <>
        <ServiceDirectory />
        <ServiceCard service={bath} />
      </>,
    );
    const admin = renderToStaticMarkup(
      <>
        <ServiceDirectory showPrices />
        <ServiceCard
          service={bath}
          showPrices
          priceText={serviceCardPriceValue(bath)}
          priceDetails={<ServicePriceDetails service={bath} />}
        />
      </>,
    );
    assert.equal(containsDisplayedServicePrice(guest.replace(/<[^>]+>/g, " ")), false);
    assert.match(admin, /From \$90/);
  });

  it("hides fee and travel rates from guests until review", () => {
    const guestFees = renderToStaticMarkup(<FeesPoliciesSection />);
    const guestArea = renderToStaticMarkup(<ServiceAreaRates />);
    const staffFees = renderToStaticMarkup(<FeesPoliciesSection showPrices />);
    const staffArea = renderToStaticMarkup(<ServiceAreaRates showPrices />);
    const guestText = `${guestFees} ${guestArea}`.replace(/<[^>]+>/g, " ");

    assert.equal(/\$\s?\d/.test(guestText), false);
    assert.match(guestText, /shown when you confirm/);
    assert.match(staffFees, /\$6\.50/);
    assert.match(staffFees, /From \$20/);
    assert.match(staffFees, /From \$25/);
    assert.match(staffArea, /\$6\.50/);
    assert.match(staffArea, /\$26/);
    assert.match(staffArea, /\$85/);
  });

  it("hides mid-booking prices and shows the full quote only on review", () => {
    const primary = getServiceById("signature-bath-care");
    assert.ok(primary);
    const care = renderToStaticMarkup(
      <BookingCareOptionsStep
        pet={pet(12)}
        primaryService={primary}
        selectedIds={[GENTLE_DEMATTING_ID, MINI_TRIM_ADD_ON_ID]}
        addOnOptions={{}}
        onToggle={() => {}}
        onOptionChange={() => {}}
        onContinue={() => {}}
        onBack={() => {}}
      />,
    );
    const careText = care.replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
    assert.match(careText, /Gentle DeMatting/);
    assert.match(careText, /Extra-Gentle Senior Care/);
    assert.match(careText, /Mini Trim/);
    assert.match(careText, new RegExp(GENTLE_DEMATTING_ASSESSMENT_NOTE));
    assert.equal(containsDisplayedServicePrice(careText.replace(/<[^>]+>/g, " ")), false);

    const hiddenTravel = bookingTravelAreaCopy("extended", false);
    const shownTravel = bookingTravelAreaCopy("extended", true);
    assert.match(hiddenTravel.body, /shown on Review & Confirm/);
    assert.equal(hiddenTravel.showFee, false);
    assert.equal(shownTravel.showFee, true);
    assert.equal(bookingTravelAreaCopy("complimentary", false).showFee, false);
    const policies = readFileSync(
      new URL("../components/booking/BookingPoliciesModal.tsx", import.meta.url),
      "utf8",
    );
    const demattingFee = policies.indexOf("Dematting Fee");
    const priceGate = policies.lastIndexOf("showPrices ?", demattingFee);
    assert.ok(priceGate > 0 && priceGate < demattingFee);

    const review = renderToStaticMarkup(
      <BookingConfirmStep
        pet={pet(12)}
        service={primary}
        addOnIds={[GENTLE_DEMATTING_ID, MINI_TRIM_ADD_ON_ID]}
        addOnOptions={{}}
        address={{
          street: "100 Olive Ave",
          city: "West Palm Beach",
          state: "FL",
          zip: "33401",
        }}
        travelQuote={{
          distanceMiles: 4,
          freeMiles: 10,
          billableMiles: 0,
          fee: 0,
          withinServiceArea: true,
          withinFreeRadius: true,
          zone: "complimentary",
          summary: "Within the service area",
        } satisfies TravelQuote}
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
        idempotencyKey="33333333-3333-4333-8333-333333333333"
        onBack={() => {}}
        onReserved={() => {}}
      />,
    );
    assert.match(review, /Review &amp; Confirm/);
    assert.match(review, /\$90\.00/);
    assert.match(review, /\$30\.00/);
    assert.match(review, /Travel Fee/);
    assert.match(review, /\$0\.00/);
    assert.match(review, /Estimated Total/);
    assert.match(review, new RegExp(formatReviewMoney(120).replace("$", "\\$")));
    const reviewText = review.replaceAll("&#x27;", "'");
    assert.match(reviewText, new RegExp(GENTLE_DEMATTING_ASSESSMENT_NOTE));
    assert.match(reviewText, new RegExp(GENTLE_DEMATTING_EXCLUSION_NOTE));
    assert.match(reviewText, new RegExp(BOOKING_PRICE_DISCLAIMER));
    assert.match(review, /No charge today/);
    assert.match(review, /Cash or Zelle/);
    assert.match(review, /Confirm &amp; Submit Booking/);
    assert.equal(review.includes("$0<"), false);
    assert.equal(review.includes("Complimentary"), false);
  });
});

describe("bills and visits", () => {
  it("does not repeat an add-on or invent a free DeMatting line", () => {
    const lines = buildDefaultLineItems(
      appointment({
        addOnIds: [MINI_TRIM_ADD_ON_ID, MINI_TRIM_ADD_ON_ID, GENTLE_DEMATTING_ID],
        estimatedTotal: 120,
      }),
      12,
    );
    assert.equal(lines.filter((item) => item.catalogId === MINI_TRIM_ADD_ON_ID).length, 1);
    assert.equal(lines.some((item) => item.catalogId === GENTLE_DEMATTING_ID), false);
    assert.equal(lines.some((item) => item.amount === 0), false);
    const resolved = resolveAddOnCharges(
      "signature-bath-care",
      [MINI_TRIM_ADD_ON_ID, MINI_TRIM_ADD_ON_ID],
      12,
    );
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0]?.kind === "priced" && resolved[0].amount, 30);
  });

  it("charges travel once and keeps each dog's add-ons on a shared visit", () => {
    const bill = buildVisitBill({
      visitId: "visit-1",
      customerName: "Tia",
      serviceDate: "2026-10-20",
      arrivalLabel: "10:00 AM",
      travelFee: 13,
      pets: [
        {
          appointmentId: "daisy",
          petName: "Daisy",
          serviceName: "Signature Bath",
          servicePrice: 90,
          status: "confirmed",
          serviceEndedAt: "2026-10-20T15:00:00.000Z",
          addOns: [{ label: "Mini Trim", amount: 30, catalogId: MINI_TRIM_ADD_ON_ID }],
        },
        {
          appointmentId: "milo",
          petName: "Milo",
          serviceName: "Signature Bath",
          servicePrice: 110,
          status: "confirmed",
          serviceEndedAt: "2026-10-20T16:00:00.000Z",
          addOns: [
            { label: "DeShedding Care", amount: 40, catalogId: DESHEDDING_ADD_ON_ID },
            { label: "Extra-Gentle Senior Care", amount: 40, catalogId: SENIOR_CARE_ADD_ON_ID },
          ],
        },
      ],
    });
    assert.equal(bill.lineItems.filter((item) => item.catalogId === "travel-fee").length, 1);
    assert.equal(bill.travelFee, 13);
    assert.equal(bill.subtotal, 90 + 30 + 110 + 40 + 40 + 13);
    assert.equal(
      bill.lineItems.filter((item) => item.catalogId === MINI_TRIM_ADD_ON_ID).length,
      1,
    );
  });

  it("lets an admin enter the assessed DeMatting amount without suggesting the internal floor", () => {
    const groups = catalogChargeGroups(20);
    const dematting = groups
      .flatMap((group) => group.items)
      .find((item) => item.id === GENTLE_DEMATTING_ID);
    const mini = groups
      .flatMap((group) => group.items)
      .find((item) => item.id === MINI_TRIM_ADD_ON_ID);
    assert.equal(dematting?.suggestedAmount, null);
    assert.equal(mini?.suggestedAmount, 30);
    const adjusted = sanitizeLineItems([
      {
        label: "Gentle DeMatting",
        amount: 45,
        catalogId: GENTLE_DEMATTING_ID,
      },
    ]);
    assert.equal(adjusted?.[0]?.amount, 45);
  });
});

describe("Full Groom estimate copy", () => {
  it("shows the starting coat price note and does not claim coat type is already known", () => {
    const quoted = quoteGuestBooking({
      serviceId: "custom-full-haircut",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(quoted.ok, true);
    if (!quoted.ok) return;
    assert.equal(
      quoted.quote.estimateNote,
      "This estimate reflects the starting coat price for your dog's weight. The price may vary based on your dog's coat situation, which will be discussed with you before your appointment.",
    );
    const html = renderToStaticMarkup(
      <BookingReviewQuote quote={quoted.quote} />,
    ).replaceAll("&#x27;", "'");
    assert.match(html, /Pricing Notice/);
    assert.match(html, new RegExp(quoted.quote.estimateNote));
    assert.match(html, new RegExp(BOOKING_PRICE_DISCLAIMER));
    assert.equal(/coat type/i.test(html), false);
  });
});

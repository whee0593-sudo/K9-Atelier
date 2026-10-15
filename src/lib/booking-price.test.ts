import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  AppointmentValidationError,
  validateCreateAppointmentInput,
} from "@/lib/appointments/validation";
import {
  BOOKING_PRICE_DISCLAIMER,
  FULL_GROOM_ESTIMATE_NOTE,
  HAND_STRIPPING_ESTIMATE_NOTE,
  createSubmitGuard,
  evaluateSubmittedBookingPrice,
  quoteGuestBooking,
} from "@/lib/booking-price";
import { getUpcomingBookableDates } from "@/lib/booking-slots";

function body(overrides: Record<string, unknown> = {}) {
  const appointmentDate = getUpcomingBookableDates(1)[0]?.value ?? "2026-10-16";
  return {
    petId: "11111111-1111-4111-8111-111111111111",
    serviceId: "signature-bath-care",
    serviceName: "Signature Bath & Care",
    addOnIds: [],
    addOnOptions: {},
    address: {
      street: "100 Olive Ave",
      city: "West Palm Beach",
      state: "FL",
      zip: "33401",
    },
    travelDistanceMiles: 4,
    travelFee: 0,
    appointmentDate,
    appointmentTime: "10–11 AM",
    slotStartMinutes: 600,
    addressLat: 26.7153,
    addressLon: -80.0534,
    estimatedTotal: 1,
    paymentMethodId: "22222222-2222-4222-8222-222222222222",
    customerPhone: "5613466778",
    customerFirstName: "Tia",
    customerLastName: "Francavilla",
    ...overrides,
  };
}

describe("guest booking price", () => {
  it("prices the signature bath from the catalog and keeps travel separate", () => {
    const quoted = quoteGuestBooking({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(quoted.ok, true);
    if (!quoted.ok) return;
    assert.equal(quoted.quote.serviceName, "The Signature Bath");
    assert.equal(quoted.quote.servicePrice, 90);
    assert.equal(quoted.quote.servicePriceLabel, "From $90");
    assert.equal(quoted.quote.addOnLabel, "None");
    assert.equal(quoted.quote.travelFee, 0);
    assert.equal(quoted.quote.travelFeeLabel, "Complimentary");
    assert.equal(quoted.quote.estimatedTotal, 90);
    assert.equal(quoted.quote.totalLabel, "From $90");
  });

  it("updates the service price when the service changes", () => {
    const bath = quoteGuestBooking({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    const groom = quoteGuestBooking({
      serviceId: "custom-full-haircut",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(bath.ok && bath.quote.estimatedTotal, 90);
    assert.equal(groom.ok && groom.quote.estimatedTotal, 140);
    assert.equal(groom.ok && groom.quote.servicePriceLabel, "From $140");
    assert.equal(groom.ok && groom.quote.estimateNote, FULL_GROOM_ESTIMATE_NOTE);
  });

  it("updates the travel fee when the distance changes", () => {
    const near = quoteGuestBooking({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    const farther = quoteGuestBooking({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 12,
    });
    assert.equal(near.ok && near.quote.travelFee, 0);
    assert.equal(farther.ok && farther.quote.travelFee, 13);
    assert.equal(farther.ok && farther.quote.travelFeeLabel, "$13");
    assert.equal(farther.ok && farther.quote.estimatedTotal, 103);
  });

  it("adds a legal add-on and prices creative color from the selected option", () => {
    const quoted = quoteGuestBooking({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: ["dematting-brush-out", "creative-accent-coloring"],
      addOnOptions: { "creative-accent-coloring": "Temporary Fun" },
      distanceMiles: 4,
    });
    assert.equal(quoted.ok, true);
    if (!quoted.ok) return;
    assert.equal(quoted.quote.addOnPrice, 80);
    assert.equal(quoted.quote.estimatedServicePrice, 170);
    assert.equal(quoted.quote.estimatedTotal, 170);
  });

  it("describes hand stripping as one hour at the hourly rate", () => {
    const quoted = quoteGuestBooking({
      serviceId: "hand-stripping",
      weightLbs: 50,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(quoted.ok, true);
    if (!quoted.ok) return;
    assert.equal(quoted.quote.servicePrice, 160);
    assert.equal(quoted.quote.servicePriceLabel, "$160/hr");
    assert.equal(quoted.quote.totalLabel, "$160");
    assert.equal(quoted.quote.estimateNote, HAND_STRIPPING_ESTIMATE_NOTE);
    assert.equal(quoted.quote.pricingBasis, "hourly");
  });

  it("rejects a service the weight cannot book", () => {
    const quoted = quoteGuestBooking({
      serviceId: "signature-bath-care",
      weightLbs: 50,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(quoted.ok, false);
    if (quoted.ok) return;
    assert.equal(quoted.code, "weight_limit");
  });

  it("rejects an unknown service, creative coloring alone, and an illegal add-on", () => {
    const unknown = quoteGuestBooking({
      serviceId: "not-a-service",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    const addon = quoteGuestBooking({
      serviceId: "hand-stripping",
      weightLbs: 20,
      addOnIds: ["mini-trim"],
      addOnOptions: {},
      distanceMiles: 4,
    });
    const creativePrimary = quoteGuestBooking({
      serviceId: "creative-accent-coloring",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: { "creative-accent-coloring": "Temporary Fun" },
      distanceMiles: 4,
    });
    assert.equal(unknown.ok, false);
    assert.equal(addon.ok, false);
    assert.equal(creativePrimary.ok, false);
    if (!addon.ok) assert.equal(addon.code, "invalid_addon");
  });
});

describe("submitted booking price", () => {
  it("rejects a tampered total and returns the catalog quote", () => {
    const result = evaluateSubmittedBookingPrice(
      {
        serviceId: "signature-bath-care",
        addOnIds: [],
        addOnOptions: {},
        distanceMiles: 12,
        estimatedTotal: 90,
      },
      12,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "price_changed");
    assert.equal(result.quote?.estimatedTotal, 103);
    assert.equal(result.quote?.travelFee, 13);
    assert.equal(result.quote?.servicePrice, 90);
  });

  it("accepts the catalog total and does not trust a lower submitted number", () => {
    const honest = evaluateSubmittedBookingPrice(
      {
        serviceId: "signature-bath-care",
        addOnIds: ["dematting-brush-out"],
        addOnOptions: {},
        distanceMiles: 4,
        estimatedTotal: 120,
      },
      12,
    );
    const tampered = evaluateSubmittedBookingPrice(
      {
        serviceId: "signature-bath-care",
        addOnIds: ["dematting-brush-out"],
        addOnOptions: {},
        distanceMiles: 4,
        estimatedTotal: 20,
      },
      12,
    );
    assert.equal(honest.ok, true);
    if (honest.ok) {
      assert.equal(honest.quote.estimatedServicePrice, 120);
      assert.equal(honest.quote.travelFee, 0);
    }
    assert.equal(tampered.ok, false);
  });

  it("keeps a tampered confirmed total unchanged during request validation", () => {
    const input = validateCreateAppointmentInput(body({ estimatedTotal: 1 }));
    assert.equal(input.estimatedTotal, 1);
    assert.equal(input.travelFee, 0);
  });

  it("rejects an illegal add-on before an appointment can be created", () => {
    assert.throws(
      () =>
        validateCreateAppointmentInput(
          body({
            serviceId: "hand-stripping",
            addOnIds: ["mini-trim"],
            estimatedTotal: 160,
          }),
        ),
      (error: unknown) =>
        error instanceof AppointmentValidationError &&
        error.field === "addOnIds",
    );
  });

  it("rejects creative coloring as a standalone service", () => {
    assert.throws(
      () =>
        validateCreateAppointmentInput(
          body({
            serviceId: "creative-accent-coloring",
            addOnOptions: { "creative-accent-coloring": "Temporary Fun" },
            estimatedTotal: 50,
          }),
        ),
      (error: unknown) =>
        error instanceof AppointmentValidationError &&
        error.message === "That service cannot be booked.",
    );
  });

  it("keeps complimentary end-of-life care priced from the catalog", () => {
    const quoted = quoteGuestBooking({
      serviceId: "end-of-life-care",
      weightLbs: 50,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(quoted.ok, true);
    if (!quoted.ok) return;
    assert.equal(quoted.quote.servicePrice, 0);
    assert.equal(quoted.quote.servicePriceLabel, "Complimentary");
    assert.equal(quoted.quote.totalLabel, "Complimentary");
  });
});

describe("booking submit guard", () => {
  it("ignores a second click while the first submit is still running", () => {
    const guard = createSubmitGuard();
    assert.equal(guard.start(), true);
    assert.equal(guard.start(), false);
    guard.end();
    assert.equal(guard.start(), true);
  });
});

describe("create appointment price gate", () => {
  it("prices the visit before any insert and sends notifications once after that", () => {
    const source = readFileSync(
      new URL("./appointments/service.ts", import.meta.url),
      "utf8",
    );
    const priceAt = source.indexOf("const priced = evaluateSubmittedBookingPrice");
    const visitAt = source.indexOf('.from("visits")');
    const emailAt = source.lastIndexOf("sendAppointmentCreatedEmails(");
    assert.ok(priceAt > 0);
    assert.ok(priceAt < visitAt);
    assert.ok(visitAt < emailAt);
    assert.equal(source.split("sendAppointmentCreatedEmails(").length - 1, 1);
    assert.match(source, /status = "confirmed"/);
    assert.match(source, /assignArrivalWindow\(/);
    assert.match(source, /travel_fee: quote\.travelFee/);
    assert.match(source, /estimated_total: quote\.estimatedTotal/);
    assert.equal(source.includes("input.estimatedTotal"), true);
    assert.equal(source.includes("servicePriceFromEstimatedTotal"), false);
  });

  it("keeps the customer disclaimer text exact", () => {
    assert.equal(
      BOOKING_PRICE_DISCLAIMER,
      "Your estimated total is based on the selected services and available pet information. Final pricing may vary depending on coat condition, time required, or additional care. Any additional charges will be discussed before proceeding.",
    );
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  guestBookingStoredAddOnOptions,
  guestBookingStoredServicePrice,
  primaryServicePriceFromLineItems,
} from "@/lib/appointments/stored-service-price";
import { quoteGuestBooking } from "@/lib/booking-price";
import { VISIT_LINE_ITEMS_KEY } from "@/lib/charges/visit-line-items";
import { visitCheckoutPetFromStoredAppointment } from "@/lib/charges/stored-visit-pet";
import { buildVisitBill } from "@/lib/charges/visit-bill";
import type { VisitCheckoutPet } from "@/lib/charges/visit-bill";
import { serviceWithoutMenuPrices } from "@/lib/public-service";
import { getServiceById } from "@/lib/service-page";
import {
  CREATIVE_ACCENT_COLORING_ID,
  DESHEDDING_ADD_ON_ID,
  DESHEDDING_ALREADY_INCLUDED_MESSAGE,
  GENTLE_DEMATTING_ID,
  MINI_TRIM_ADD_ON_ID,
  SENIOR_CARE_ADD_ON_ID,
  addOnSelectionMessage,
  bookedServiceAmount,
} from "@/lib/services";

function storedFromGuestBooking(input: {
  appointmentId: string;
  petName: string;
  weightLbs: number;
  serviceId: string;
  addOnIds: string[];
  addOnOptions?: Record<string, string>;
  distanceMiles?: number;
}) {
  const quoted = quoteGuestBooking({
    serviceId: input.serviceId,
    weightLbs: input.weightLbs,
    addOnIds: input.addOnIds,
    addOnOptions: input.addOnOptions ?? {},
    distanceMiles: input.distanceMiles ?? 4,
  });
  assert.equal(quoted.ok, true);
  if (!quoted.ok) throw new Error(quoted.message);
  const servicePrice = guestBookingStoredServicePrice(quoted.quote);
  const addOnOptions = guestBookingStoredAddOnOptions(
    quoted.quote,
    input.addOnOptions ?? {},
  );
  const pet = visitCheckoutPetFromStoredAppointment({
    id: input.appointmentId,
    status: "confirmed",
    serviceName: quoted.quote.serviceName,
    serviceId: quoted.quote.serviceId,
    servicePrice,
    serviceEndedAt: "2026-10-20T15:00:00.000Z",
    addOnIds: input.addOnIds,
    addOnOptions,
    petName: input.petName,
    weightLbs: input.weightLbs,
  });
  return { quote: quoted.quote, servicePrice, pet };
}

function collect(pets: VisitCheckoutPet[], travelFee: number) {
  return buildVisitBill({
    visitId: "visit-guest",
    customerName: "Tia",
    serviceDate: "2026-10-20",
    arrivalLabel: "10:00 AM",
    travelFee,
    pets,
  });
}

function amountFor(petName: string, catalogId: string, pets: ReturnType<typeof collect>) {
  return pets.lineItems.find(
    (item) => item.petName === petName && item.catalogId === catalogId,
  )?.amount;
}

describe("guest booking through visit collection", () => {
  it("stores Signature Bath separately from Mini Trim and bills each once", () => {
    const booked = storedFromGuestBooking({
      appointmentId: "daisy",
      petName: "Daisy",
      weightLbs: 12,
      serviceId: "signature-bath-care",
      addOnIds: [MINI_TRIM_ADD_ON_ID],
    });
    assert.equal(booked.quote.servicePrice, 90);
    assert.equal(booked.quote.addOnPrice, 30);
    assert.equal(booked.quote.estimatedServicePrice, 120);
    assert.equal(booked.quote.estimatedTotal, 120);
    assert.equal(booked.servicePrice, 90);
    assert.equal(booked.pet.servicePrice, 90);

    const bill = collect([booked.pet], booked.quote.travelFee);
    assert.equal(amountFor("Daisy", "visit-pet-service", bill), 90);
    assert.equal(amountFor("Daisy", MINI_TRIM_ADD_ON_ID, bill), 30);
    assert.equal(
      bill.lineItems.filter((item) => item.catalogId === MINI_TRIM_ADD_ON_ID).length,
      1,
    );
    assert.equal(bill.subtotal, 120);
    assert.equal(bill.lineItems.some((item) => item.amount === 0), false);
  });

  it("bills DeShedding, Senior Care, and Creative Accent Color once each", () => {
    const shedding = storedFromGuestBooking({
      appointmentId: "shed",
      petName: "Maple",
      weightLbs: 20,
      serviceId: "signature-bath-care",
      addOnIds: [DESHEDDING_ADD_ON_ID],
    });
    assert.equal(shedding.servicePrice, 110);
    assert.equal(shedding.quote.estimatedTotal, 150);
    const sheddingBill = collect([shedding.pet], 0);
    assert.equal(amountFor("Maple", "visit-pet-service", sheddingBill), 110);
    assert.equal(amountFor("Maple", DESHEDDING_ADD_ON_ID, sheddingBill), 40);
    assert.equal(sheddingBill.subtotal, 150);

    const senior = storedFromGuestBooking({
      appointmentId: "senior",
      petName: "Birdie",
      weightLbs: 20,
      serviceId: "signature-bath-care",
      addOnIds: [SENIOR_CARE_ADD_ON_ID],
    });
    assert.equal(senior.servicePrice, 110);
    const seniorBill = collect([senior.pet], 0);
    assert.equal(amountFor("Birdie", SENIOR_CARE_ADD_ON_ID, seniorBill), 40);
    assert.equal(seniorBill.subtotal, 150);

    const color = storedFromGuestBooking({
      appointmentId: "color",
      petName: "Pixel",
      weightLbs: 12,
      serviceId: "signature-bath-care",
      addOnIds: [CREATIVE_ACCENT_COLORING_ID],
      addOnOptions: { [CREATIVE_ACCENT_COLORING_ID]: "Temporary Fun" },
    });
    assert.equal(color.quote.addOnPrice, 50);
    assert.equal(color.quote.estimatedTotal, 140);
    assert.equal(color.servicePrice, 90);
    const colorBill = collect([color.pet], 0);
    assert.equal(amountFor("Pixel", "visit-pet-service", colorBill), 90);
    assert.equal(amountFor("Pixel", CREATIVE_ACCENT_COLORING_ID, colorBill), 50);
    assert.equal(
      colorBill.lineItems.filter(
        (item) => item.catalogId === CREATIVE_ACCENT_COLORING_ID,
      ).length,
      1,
    );
    assert.equal(colorBill.subtotal, 140);
  });

  it("keeps an unquoted Gentle DeMatting selection off the bill", () => {
    const booked = storedFromGuestBooking({
      appointmentId: "mat",
      petName: "Nori",
      weightLbs: 12,
      serviceId: "signature-bath-care",
      addOnIds: [GENTLE_DEMATTING_ID],
    });
    assert.equal(booked.servicePrice, 90);
    assert.equal(booked.quote.addOnPrice, 0);
    assert.equal(booked.quote.estimatedTotal, 90);
    const bill = collect([booked.pet], 0);
    assert.equal(bill.subtotal, 90);
    assert.equal(
      bill.lineItems.some((item) => item.catalogId === GENTLE_DEMATTING_ID),
      false,
    );
    assert.equal(bill.lineItems.some((item) => item.amount === 0), false);
  });

  it("bills two dogs on one visit from their own stored service prices", () => {
    const daisy = storedFromGuestBooking({
      appointmentId: "daisy",
      petName: "Daisy",
      weightLbs: 12,
      serviceId: "signature-bath-care",
      addOnIds: [MINI_TRIM_ADD_ON_ID],
    });
    const milo = storedFromGuestBooking({
      appointmentId: "milo",
      petName: "Milo",
      weightLbs: 20,
      serviceId: "signature-bath-care",
      addOnIds: [DESHEDDING_ADD_ON_ID, SENIOR_CARE_ADD_ON_ID],
      distanceMiles: 12,
    });
    assert.equal(daisy.servicePrice, 90);
    assert.equal(milo.servicePrice, 110);
    assert.equal(milo.quote.travelFee, 13);
    assert.equal(milo.quote.estimatedTotal, 110 + 40 + 40 + 13);

    const bill = collect([daisy.pet, milo.pet], milo.quote.travelFee);
    assert.equal(amountFor("Daisy", "visit-pet-service", bill), 90);
    assert.equal(amountFor("Daisy", MINI_TRIM_ADD_ON_ID, bill), 30);
    assert.equal(amountFor("Milo", "visit-pet-service", bill), 110);
    assert.equal(amountFor("Milo", DESHEDDING_ADD_ON_ID, bill), 40);
    assert.equal(amountFor("Milo", SENIOR_CARE_ADD_ON_ID, bill), 40);
    assert.equal(
      bill.lineItems.filter((item) => item.catalogId === "travel-fee").length,
      1,
    );
    assert.equal(bill.subtotal, 90 + 30 + 110 + 40 + 40 + 13);
    for (const id of [
      MINI_TRIM_ADD_ON_ID,
      DESHEDDING_ADD_ON_ID,
      SENIOR_CARE_ADD_ON_ID,
    ]) {
      assert.equal(bill.lineItems.filter((item) => item.catalogId === id).length, 1);
    }
  });

  it("keeps a staff primary amount and an admin adjustment as the service line", () => {
    const bath = getServiceById("signature-bath-care");
    assert.ok(bath);
    assert.equal(bookedServiceAmount(bath, 12, null, null), 90);

    const lines = [
      {
        id: "primary",
        label: "Signature Bath",
        amount: 95,
        catalogId: "signature-bath-care",
      },
      {
        id: "mini",
        label: "Mini Trim",
        amount: 35,
        catalogId: MINI_TRIM_ADD_ON_ID,
      },
      {
        id: "handling",
        label: "Extra handling",
        amount: 15,
      },
    ];
    assert.equal(primaryServicePriceFromLineItems(lines), 95);
    assert.equal(
      addOnSelectionMessage(["signature-bath-care"], [MINI_TRIM_ADD_ON_ID]),
      null,
    );
    const pet = visitCheckoutPetFromStoredAppointment({
      id: "adjusted",
      status: "confirmed",
      serviceName: "Signature Bath",
      serviceId: "signature-bath-care",
      servicePrice: primaryServicePriceFromLineItems(lines),
      serviceEndedAt: "2026-10-20T15:00:00.000Z",
      addOnIds: [MINI_TRIM_ADD_ON_ID],
      addOnOptions: { [VISIT_LINE_ITEMS_KEY]: lines },
      petName: "Daisy",
      weightLbs: 12,
    });
    const bill = collect([pet], 0);
    assert.equal(amountFor("Daisy", "visit-pet-service", bill), 95);
    assert.equal(amountFor("Daisy", MINI_TRIM_ADD_ON_ID, bill), 35);
    assert.equal(
      bill.lineItems.find((item) => item.label.includes("Extra handling"))?.amount,
      15,
    );
    assert.equal(bill.subtotal, 145);
    assert.equal(
      bill.lineItems.filter((item) => item.catalogId === MINI_TRIM_ADD_ON_ID).length,
      1,
    );
  });

  it("asks before an included add-on and does not bill it twice", () => {
    assert.equal(
      addOnSelectionMessage(["luxury-spa-day"], [DESHEDDING_ADD_ON_ID]),
      DESHEDDING_ALREADY_INCLUDED_MESSAGE,
    );
    const silent = visitCheckoutPetFromStoredAppointment({
      id: "spa",
      status: "confirmed",
      serviceName: "Luxury Spa Day",
      serviceId: "luxury-spa-day",
      servicePrice: 140,
      serviceEndedAt: "2026-10-20T15:00:00.000Z",
      addOnIds: [DESHEDDING_ADD_ON_ID],
      addOnOptions: {},
      petName: "Lulu",
      weightLbs: 12,
    });
    assert.equal(silent.addOns?.length ?? 0, 0);
    assert.equal(silent.priceReviewRequired, true);

    const confirmed = visitCheckoutPetFromStoredAppointment({
      id: "spa-confirmed",
      status: "confirmed",
      serviceName: "Luxury Spa Day",
      serviceId: "luxury-spa-day",
      servicePrice: 140,
      serviceEndedAt: "2026-10-20T15:00:00.000Z",
      addOnIds: [DESHEDDING_ADD_ON_ID],
      addOnOptions: {
        [VISIT_LINE_ITEMS_KEY]: [
          {
            id: "primary",
            label: "Luxury Spa Day",
            amount: 140,
            catalogId: "luxury-spa-day",
          },
          {
            id: "shed",
            label: "DeShedding Care",
            amount: 40,
            catalogId: DESHEDDING_ADD_ON_ID,
          },
        ],
      },
      petName: "Lulu",
      weightLbs: 12,
    });
    const bill = collect([confirmed], 0);
    assert.equal(amountFor("Lulu", "visit-pet-service", bill), 140);
    assert.equal(amountFor("Lulu", DESHEDDING_ADD_ON_ID, bill), 40);
    assert.equal(
      bill.lineItems.filter((item) => item.catalogId === DESHEDDING_ADD_ON_ID).length,
      1,
    );
    assert.equal(bill.subtotal, 180);
  });

  it("writes the primary quote amount and collects through the stored visit pet", () => {
    const booking = readFileSync(
      new URL("./service.ts", import.meta.url),
      "utf8",
    );
    const collectSource = readFileSync(
      new URL("../charges/service.ts", import.meta.url),
      "utf8",
    );
    assert.match(booking, /guestBookingStoredServicePrice\(quote\)/);
    assert.match(booking, /guestBookingStoredAddOnOptions\(quote, input\.addOnOptions\)/);
    assert.equal(
      booking.includes("snapshotServicePrice(quote.estimatedServicePrice)"),
      false,
    );
    assert.match(collectSource, /visitCheckoutPetFromStoredAppointment/);
  });
});

describe("public service payloads", () => {
  it("omits menu prices from the service card data guests receive", () => {
    const groom = getServiceById("custom-full-haircut");
    const coloring = getServiceById(CREATIVE_ACCENT_COLORING_ID);
    assert.ok(groom && coloring);
    const groomPayload = JSON.stringify(serviceWithoutMenuPrices(groom));
    const colorPayload = JSON.stringify(serviceWithoutMenuPrices(coloring));
    assert.equal(groomPayload.includes("priceFrom"), false);
    assert.equal(groomPayload.includes("coatTypePrices"), false);
    assert.equal(colorPayload.includes("priceFrom"), false);
    assert.equal(colorPayload.includes("$"), false);
    assert.match(groomPayload, /custom-full-haircut/);
  });
});

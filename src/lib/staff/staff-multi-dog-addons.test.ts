import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import { buildVisitBill } from "@/lib/charges/visit-bill";
import { visitCheckoutPetFromStoredAppointment } from "@/lib/charges/stored-visit-pet";
import {
  DESHEDDING_ADD_ON_ID,
  GENTLE_DEMATTING_ID,
  MINI_TRIM_ADD_ON_ID,
  SENIOR_CARE_ADD_ON_ID,
} from "@/lib/services";
import {
  StaffBookingValidationError,
  validateStaffCustomerBookingInput,
} from "@/lib/staff/create-customer-booking-input";
import { staffAppointmentPriceDrafts } from "@/lib/staff/staff-appointment-drafts";

function bookingBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "5615550123",
    notifyEmail: true,
    notifySms: true,
    verbalConsent: true,
    appointmentDate: getUpcomingBookableDates(1)[0]?.value ?? "2026-09-18",
    slotStartMinutes: 600,
    address: {
      street: "100 Olive Ave",
      city: "West Palm Beach",
      state: "FL",
      zip: "33401",
    },
    ...overrides,
  };
}

function draftsFor(body: Record<string, unknown>, travelFee: number) {
  const input = validateStaffCustomerBookingInput(body);
  const pricing = staffAppointmentPriceDrafts(
    input.pets.map((pet) => ({
      weightLbs: pet.weightLbs,
      serviceIds: pet.serviceIds,
      serviceOptionNames: pet.serviceOptionNames,
      servicePrices: pet.servicePrices,
      addOnIds: pet.addOnIds,
      addOnOptions: pet.addOnOptions,
    })),
    travelFee,
  );
  assert.equal(pricing.ok, true);
  if (!pricing.ok) throw new Error(pricing.message);
  return { input, drafts: pricing.drafts };
}

describe("staff multi-dog add-ons", () => {
  it("rejects one add-on list copied onto every dog", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          bookingBody({
            addOnIds: [MINI_TRIM_ADD_ON_ID],
            pets: [
              {
                name: "Daisy",
                breed: "Poodle",
                weightLbs: 12,
                serviceIds: ["signature-bath-care"],
              },
              {
                name: "Milo",
                breed: "Doodle",
                weightLbs: 20,
                serviceIds: ["signature-bath-care"],
              },
            ],
          }),
        ),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.field === "addOnIds" &&
        /each dog/i.test(error.message),
    );
  });

  it("stores each dog's add-ons once and charges travel once", () => {
    const { drafts } = draftsFor(
      bookingBody({
        pets: [
          {
            name: "Daisy",
            breed: "Poodle",
            weightLbs: 12,
            serviceIds: ["signature-bath-care"],
            addOnIds: [MINI_TRIM_ADD_ON_ID],
          },
          {
            name: "Milo",
            breed: "Doodle",
            weightLbs: 20,
            serviceIds: ["signature-bath-care"],
            addOnIds: [DESHEDDING_ADD_ON_ID, SENIOR_CARE_ADD_ON_ID],
          },
        ],
      }),
      13,
    );

    assert.equal(drafts.length, 2);
    assert.deepEqual(drafts[0]?.addOnIds, [MINI_TRIM_ADD_ON_ID]);
    assert.deepEqual(drafts[1]?.addOnIds, [
      DESHEDDING_ADD_ON_ID,
      SENIOR_CARE_ADD_ON_ID,
    ]);
    assert.equal(drafts[0]?.servicePrice, 90);
    assert.equal(drafts[1]?.servicePrice, 110);
    assert.equal(drafts[0]?.travelFee, 13);
    assert.equal(drafts[1]?.travelFee, 0);
    assert.equal(drafts[0]?.estimatedTotal, 133);
    assert.equal(drafts[1]?.estimatedTotal, 190);
    assert.deepEqual(
      drafts.map((draft) => draft.visitSequence),
      [1, 2],
    );

    const pets = drafts.map((draft, index) =>
      visitCheckoutPetFromStoredAppointment({
        id: index === 0 ? "daisy" : "milo",
        status: "confirmed",
        serviceName: draft.serviceName,
        serviceId: draft.serviceId,
        servicePrice: draft.servicePrice,
        serviceEndedAt: "2026-10-20T15:00:00.000Z",
        addOnIds: draft.addOnIds,
        addOnOptions: draft.addOnOptions,
        petName: index === 0 ? "Daisy" : "Milo",
        weightLbs: index === 0 ? 12 : 20,
      }),
    );
    const bill = buildVisitBill({
      visitId: "visit-staff",
      customerName: "Ada",
      serviceDate: "2026-10-20",
      arrivalLabel: "10:00 AM",
      travelFee: 13,
      pets,
    });

    const amount = (petName: string, catalogId: string) =>
      bill.lineItems.find(
        (item) => item.petName === petName && item.catalogId === catalogId,
      )?.amount;
    assert.equal(amount("Daisy", "visit-pet-service"), 90);
    assert.equal(amount("Daisy", MINI_TRIM_ADD_ON_ID), 30);
    assert.equal(amount("Milo", "visit-pet-service"), 110);
    assert.equal(amount("Milo", DESHEDDING_ADD_ON_ID), 40);
    assert.equal(amount("Milo", SENIOR_CARE_ADD_ON_ID), 40);
    assert.equal(
      bill.lineItems.filter((item) => item.catalogId === "travel-fee").length,
      1,
    );
    assert.equal(bill.subtotal, 323);
    for (const id of [
      MINI_TRIM_ADD_ON_ID,
      DESHEDDING_ADD_ON_ID,
      SENIOR_CARE_ADD_ON_ID,
    ]) {
      assert.equal(bill.lineItems.filter((item) => item.catalogId === id).length, 1);
    }
  });

  it("keeps an unquoted Gentle DeMatting selection off the other dog's bill", () => {
    const { drafts } = draftsFor(
      bookingBody({
        pets: [
          {
            name: "Nori",
            breed: "Mix",
            weightLbs: 12,
            serviceIds: ["signature-bath-care"],
            addOnIds: [GENTLE_DEMATTING_ID],
          },
          {
            name: "Daisy",
            breed: "Poodle",
            weightLbs: 12,
            serviceIds: ["signature-bath-care"],
            addOnIds: [MINI_TRIM_ADD_ON_ID],
          },
        ],
      }),
      0,
    );
    assert.deepEqual(drafts[0]?.addOnIds, [GENTLE_DEMATTING_ID]);
    assert.deepEqual(drafts[1]?.addOnIds, [MINI_TRIM_ADD_ON_ID]);
    assert.equal(drafts[0]?.servicePrice, 90);
    assert.equal(drafts[0]?.estimatedTotal, 90);

    const pets = drafts.map((draft, index) =>
      visitCheckoutPetFromStoredAppointment({
        id: `pet-${index}`,
        status: "confirmed",
        serviceName: draft.serviceName,
        serviceId: draft.serviceId,
        servicePrice: draft.servicePrice,
        serviceEndedAt: "2026-10-20T15:00:00.000Z",
        addOnIds: draft.addOnIds,
        addOnOptions: draft.addOnOptions,
        petName: index === 0 ? "Nori" : "Daisy",
        weightLbs: 12,
      }),
    );
    const bill = buildVisitBill({
      visitId: "visit-demat",
      customerName: "Ada",
      serviceDate: "2026-10-20",
      arrivalLabel: "10:00 AM",
      travelFee: 0,
      pets,
    });
    assert.equal(
      bill.lineItems.some((item) => item.catalogId === GENTLE_DEMATTING_ID),
      false,
    );
    assert.equal(bill.lineItems.some((item) => item.amount === 0), false);
    assert.equal(
      bill.lineItems.find((item) => item.catalogId === MINI_TRIM_ADD_ON_ID)?.amount,
      30,
    );
    assert.equal(bill.subtotal, 210);
  });

  it("writes those drafts from the staff booking insert and keeps one visit travel fee", () => {
    const source = readFileSync(
      new URL("./create-customer-booking.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /staffAppointmentPriceDrafts\(/);
    assert.match(source, /add_on_ids: draft\.addOnIds/);
    assert.match(source, /travel_fee: draft\.travelFee/);
    assert.equal(source.includes("add_on_ids: input.addOnIds"), false);
    assert.match(source, /firstSchedule/);
    assert.match(source, /buildSameAddressCompanionInsertion\(/);
    assert.match(source, /travel_fee: effectiveTravelFee\(quote\.fee, input\.travelFeeOverride\)/);
  });
});

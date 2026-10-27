import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { changeFeeAmount, changeNoticeBand } from "@/lib/appointments/change-policy";
import {
  changeFeeBase,
  guestBookingStoredAddOnOptions,
  guestBookingStoredServicePrice,
} from "@/lib/appointments/stored-service-price";
import { quoteGuestBooking } from "@/lib/booking-price";
import {
  attachBookingPriceSnapshot,
  PRICED_ADD_ONS_KEY,
  SERVICE_PRICE_SCOPE_KEY,
} from "@/lib/charges/visit-line-items";
import { visitCheckoutPetFromStoredAppointment } from "@/lib/charges/stored-visit-pet";
import { buildVisitBill, visitChargeGate } from "@/lib/charges/visit-bill";
import {
  buildCollectChargePaymentFields,
  isManualTender,
} from "@/lib/charges/tender";
import { planTravelFeeMirror } from "@/lib/visits/visit";
import {
  addOnSelectionMessage,
  DESHEDDING_ADD_ON_ID,
  DESHEDDING_ALREADY_INCLUDED_MESSAGE,
  GENTLE_DEMATTING_ID,
  MINI_TRIM_ADD_ON_ID,
  MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
} from "@/lib/services";

const ended = "2026-10-20T15:00:00.000Z";

function guestStored(input: {
  serviceId: string;
  weightLbs: number;
  addOnIds: string[];
  addOnOptions?: Record<string, string>;
  distanceMiles?: number;
  petName: string;
}) {
  const quoted = quoteGuestBooking({
    serviceId: input.serviceId,
    weightLbs: input.weightLbs,
    addOnIds: input.addOnIds,
    addOnOptions: input.addOnOptions ?? {},
    distanceMiles: input.distanceMiles ?? 12,
  });
  assert.equal(quoted.ok, true);
  if (!quoted.ok) throw new Error(quoted.message);
  return {
    quote: quoted.quote,
    servicePrice: guestBookingStoredServicePrice(quoted.quote),
    addOnOptions: guestBookingStoredAddOnOptions(
      quoted.quote,
      input.addOnOptions ?? {},
    ),
  };
}

function petFrom(input: {
  id: string;
  petName: string;
  serviceName: string;
  serviceId: string;
  servicePrice: number | null;
  addOnIds: string[];
  addOnOptions: Record<string, unknown>;
  weightLbs?: number | null;
}) {
  return visitCheckoutPetFromStoredAppointment({
    id: input.id,
    status: "confirmed",
    serviceName: input.serviceName,
    serviceId: input.serviceId,
    servicePrice: input.servicePrice,
    serviceEndedAt: ended,
    addOnIds: input.addOnIds,
    addOnOptions: input.addOnOptions,
    petName: input.petName,
    weightLbs: input.weightLbs ?? 12,
  });
}

function billFor(
  pets: ReturnType<typeof petFrom>[],
  travelFee: number,
) {
  return buildVisitBill({
    visitId: "visit-scheme-b",
    customerName: "Tia",
    serviceDate: "2026-10-20",
    arrivalLabel: "10:00 AM",
    travelFee,
    pets,
  });
}

describe("confirmed visit billing", () => {
  it("bills Mini Trim at the frozen $30 beside the main service", () => {
    const stored = guestStored({
      serviceId: "signature-bath-care",
      weightLbs: 18,
      addOnIds: [MINI_TRIM_ADD_ON_ID],
      petName: "Daisy",
      distanceMiles: 4,
    });
    assert.equal(stored.quote.servicePrice, 110);
    assert.equal(stored.quote.addOnPrice, 30);
    assert.equal(stored.quote.estimatedTotal, 140);
    assert.equal(stored.servicePrice, 110);
    const pet = petFrom({
      id: "daisy",
      petName: "Daisy",
      serviceName: stored.quote.serviceName,
      serviceId: stored.quote.serviceId,
      servicePrice: stored.servicePrice,
      addOnIds: [MINI_TRIM_ADD_ON_ID],
      addOnOptions: stored.addOnOptions,
      weightLbs: 18,
    });
    const bill = billFor([pet], 0);
    assert.equal(bill.blocked, false);
    assert.equal(
      bill.lineItems.find((item) => item.catalogId === MINI_TRIM_ADD_ON_ID)?.amount,
      30,
    );
    assert.equal(bill.subtotal, 140);
  });

  it("keeps several priced add-ons and one travel fee on the estimate and the bill", () => {
    const stored = guestStored({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: [MINI_TRIM_ADD_ON_ID, "deshedding-treatment"],
      petName: "Luna",
      distanceMiles: 12,
    });
    assert.equal(stored.quote.servicePrice, 90);
    assert.equal(stored.quote.addOnPrice, 60);
    assert.equal(stored.quote.travelFee, 13);
    assert.equal(stored.quote.estimatedTotal, 163);
    const pet = petFrom({
      id: "luna",
      petName: "Luna",
      serviceName: stored.quote.serviceName,
      serviceId: stored.quote.serviceId,
      servicePrice: stored.servicePrice,
      addOnIds: [MINI_TRIM_ADD_ON_ID, "deshedding-treatment"],
      addOnOptions: stored.addOnOptions,
    });
    const bill = billFor([pet], stored.quote.travelFee);
    assert.equal(
      bill.lineItems.filter((item) => item.catalogId === "travel-fee").length,
      1,
    );
    assert.equal(bill.subtotal, 163);
  });

  it("leaves Gentle DeMatting off the estimate until a confirmed amount is saved", () => {
    const alone = guestStored({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: [GENTLE_DEMATTING_ID],
      petName: "Nori",
      distanceMiles: 4,
    });
    assert.equal(alone.quote.estimatedTotal, 90);
    assert.equal(alone.quote.assessedAddOns.length, 1);
    const alonePet = petFrom({
      id: "nori",
      petName: "Nori",
      serviceName: alone.quote.serviceName,
      serviceId: alone.quote.serviceId,
      servicePrice: alone.servicePrice,
      addOnIds: [GENTLE_DEMATTING_ID],
      addOnOptions: alone.addOnOptions,
    });
    const aloneBill = billFor([alonePet], 0);
    assert.equal(aloneBill.blocked, false);
    assert.equal(aloneBill.subtotal, 90);
    assert.equal(
      aloneBill.lineItems.some((item) => item.catalogId === GENTLE_DEMATTING_ID),
      false,
    );

    const withTrim = guestStored({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: [GENTLE_DEMATTING_ID, MINI_TRIM_ADD_ON_ID],
      petName: "Nori",
      distanceMiles: 4,
    });
    assert.equal(withTrim.quote.addOnPrice, 30);
    assert.equal(withTrim.quote.estimatedTotal, 120);
    const pet = petFrom({
      id: "nori-trim",
      petName: "Nori",
      serviceName: withTrim.quote.serviceName,
      serviceId: withTrim.quote.serviceId,
      servicePrice: withTrim.servicePrice,
      addOnIds: [GENTLE_DEMATTING_ID, MINI_TRIM_ADD_ON_ID],
      addOnOptions: withTrim.addOnOptions,
    });
    const bill = billFor([pet], 0);
    assert.equal(bill.subtotal, 120);
    assert.equal(
      bill.lineItems.some((item) => item.amount === 0),
      false,
    );
    const confirmed = petFrom({
      id: "nori-confirmed",
      petName: "Nori",
      serviceName: "Signature Bath",
      serviceId: "signature-bath-care",
      servicePrice: 90,
      addOnIds: [GENTLE_DEMATTING_ID, MINI_TRIM_ADD_ON_ID],
      addOnOptions: {
        __visitLineItems: [
          {
            id: "service",
            label: "Signature Bath",
            amount: 90,
            catalogId: "signature-bath-care",
          },
          {
            id: "mat",
            label: "Gentle DeMatting",
            amount: 45,
            catalogId: GENTLE_DEMATTING_ID,
          },
          {
            id: "trim",
            label: "Mini Trim",
            amount: 30,
            catalogId: MINI_TRIM_ADD_ON_ID,
          },
        ],
      },
    });
    const confirmedBill = billFor([confirmed], 0);
    assert.equal(
      confirmedBill.lineItems.find((item) => item.catalogId === GENTLE_DEMATTING_ID)
        ?.amount,
      45,
    );
    assert.equal(confirmedBill.subtotal, 165);
  });

  it("does not charge add-ons that are already included", () => {
    assert.equal(
      addOnSelectionMessage(["luxury-spa-day"], [DESHEDDING_ADD_ON_ID]),
      DESHEDDING_ALREADY_INCLUDED_MESSAGE,
    );
    assert.equal(
      addOnSelectionMessage(["luxury-spa-day"], [MINI_TRIM_ADD_ON_ID]),
      MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
    );
    assert.equal(
      addOnSelectionMessage(["custom-full-haircut"], [MINI_TRIM_ADD_ON_ID]),
      MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
    );
    assert.equal(
      addOnSelectionMessage(["hand-stripping"], [MINI_TRIM_ADD_ON_ID]),
      "That add-on cannot be booked with this service.",
    );
    const spa = petFrom({
      id: "spa",
      petName: "Lulu",
      serviceName: "Luxury Spa Day",
      serviceId: "luxury-spa-day",
      servicePrice: 140,
      addOnIds: [],
      addOnOptions: attachBookingPriceSnapshot({}, [], []),
    });
    const bill = billFor([spa], 0);
    assert.equal(bill.subtotal, 140);
    assert.equal(
      bill.lineItems.some((item) => item.catalogId === DESHEDDING_ADD_ON_ID),
      false,
    );
  });

  it("bills the snapshotted add-on after the catalog price changes", () => {
    const options = attachBookingPriceSnapshot(
      {},
      [{ id: MINI_TRIM_ADD_ON_ID, label: "Mini Trim", amount: 30 }],
      [],
    );
    options[PRICED_ADD_ONS_KEY] = [
      { id: MINI_TRIM_ADD_ON_ID, label: "Mini Trim", amount: 22 },
    ];
    const pet = petFrom({
      id: "frozen",
      petName: "Daisy",
      serviceName: "Signature Bath",
      serviceId: "signature-bath-care",
      servicePrice: 90,
      addOnIds: [MINI_TRIM_ADD_ON_ID],
      addOnOptions: options,
    });
    const bill = billFor([pet], 0);
    assert.equal(
      bill.lineItems.find((item) => item.catalogId === MINI_TRIM_ADD_ON_ID)?.amount,
      22,
    );
    assert.equal(bill.subtotal, 112);
    assert.equal(options[SERVICE_PRICE_SCOPE_KEY], "base");
    assert.equal(
      changeFeeBase("cancel", [
        {
          service_price: 90,
          travel_fee: 0,
          add_on_ids: [MINI_TRIM_ADD_ON_ID],
          add_on_options: options,
        },
      ]).ok &&
        changeFeeBase("cancel", [
          {
            service_price: 90,
            travel_fee: 0,
            add_on_ids: [MINI_TRIM_ADD_ON_ID],
            add_on_options: options,
          },
        ]).amount,
      112,
    );
  });

  it("does not add add-on lines to an old guest row whose service price already includes them", () => {
    const pet = petFrom({
      id: "legacy-guest",
      petName: "Daisy",
      serviceName: "Signature Bath",
      serviceId: "signature-bath-care",
      servicePrice: 170,
      addOnIds: [MINI_TRIM_ADD_ON_ID, "deshedding-treatment"],
      addOnOptions: { "creative-accent-coloring": "Temporary Fun" },
    });
    assert.equal(pet.priceReviewRequired, true);
    assert.equal(pet.addOns?.length ?? 0, 0);
    const bill = billFor([pet], 13);
    assert.equal(bill.blockReason, "price_review");
    assert.equal(bill.blocked, true);
    assert.equal(
      bill.lineItems.some((item) => item.catalogId === MINI_TRIM_ADD_ON_ID),
      false,
    );
  });

  it("asks for review when an old staff row has add-ons but no price snapshot", () => {
    const pet = petFrom({
      id: "legacy-staff",
      petName: "Max",
      serviceName: "Signature Bath",
      serviceId: "signature-bath-care",
      servicePrice: 90,
      addOnIds: [MINI_TRIM_ADD_ON_ID],
      addOnOptions: {},
      weightLbs: 18,
    });
    assert.equal(pet.priceReviewRequired, true);
    assert.equal(pet.addOns?.length ?? 0, 0);
    const bill = billFor([pet], 0);
    assert.equal(bill.blocked, true);
    assert.equal(bill.subtotal, 90);
  });

  it("keeps a saved manual bill and does not reprice a paid visit", () => {
    const pet = petFrom({
      id: "manual",
      petName: "Daisy",
      serviceName: "Signature Bath",
      serviceId: "signature-bath-care",
      servicePrice: 90,
      addOnIds: [MINI_TRIM_ADD_ON_ID],
      addOnOptions: {
        __visitLineItems: [
          {
            id: "service",
            label: "Signature Bath",
            amount: 95,
            catalogId: "signature-bath-care",
          },
          {
            id: "trim",
            label: "Mini Trim",
            amount: 30,
            catalogId: MINI_TRIM_ADD_ON_ID,
          },
        ],
      },
    });
    const bill = billFor([pet], 13);
    assert.equal(bill.blocked, false);
    assert.equal(bill.subtotal, 138);
    assert.deepEqual(
      visitChargeGate({
        decision: "already_paid",
        blocked: true,
        blockedMessage: bill.blockedMessage,
      }),
      { allow: false, message: "This visit is already paid." },
    );
    assert.equal(
      visitChargeGate({
        decision: "create",
        blocked: true,
        blockedMessage: "Review stored charges for Daisy before collecting this visit.",
      }).allow,
      false,
    );
  });

  it("charges cancel, reschedule, and remove-dog fees from confirmed items", () => {
    const late = changeNoticeBand("2026-08-24", 10 * 60, new Date("2026-08-23T22:00:00.000Z"));
    const sameDay = changeNoticeBand("2026-08-24", 15 * 60, new Date("2026-08-24T13:00:00.000Z"));
    const free = changeNoticeBand("2026-08-24", 10 * 60, new Date("2026-08-20T15:00:00.000Z"));
    assert.equal(late, "late");
    assert.equal(sameDay, "same_day");
    assert.equal(free, "complimentary");

    const daisy = {
      service_price: 90,
      estimated_total: 133,
      travel_fee: 13,
      add_on_ids: [MINI_TRIM_ADD_ON_ID],
      add_on_options: attachBookingPriceSnapshot(
        {},
        [{ id: MINI_TRIM_ADD_ON_ID, label: "Mini Trim", amount: 30 }],
        [],
      ),
    };
    const milo = {
      service_price: 110,
      estimated_total: 190,
      travel_fee: 0,
      add_on_ids: [DESHEDDING_ADD_ON_ID, "nail-grind"],
      add_on_options: attachBookingPriceSnapshot(
        {},
        [
          { id: DESHEDDING_ADD_ON_ID, label: "DeShedding", amount: 40 },
          { id: "nail-grind", label: "Nail grind", amount: 40 },
        ],
        [],
      ),
    };
    const cancelBase = changeFeeBase("cancel", [daisy, milo]);
    const rescheduleBase = changeFeeBase("reschedule", [daisy, milo]);
    const removeCarrier = changeFeeBase("remove_dog", [daisy]);
    const removeOther = changeFeeBase("remove_dog", [milo]);
    assert.equal(cancelBase.ok && cancelBase.amount, 323);
    assert.equal(rescheduleBase.ok && rescheduleBase.amount, 323);
    assert.equal(removeCarrier.ok && removeCarrier.amount, 120);
    assert.equal(removeOther.ok && removeOther.amount, 190);
    assert.equal(changeFeeAmount("cancel", cancelBase.ok ? cancelBase.amount : 0, late), 161.5);
    assert.equal(
      changeFeeAmount("cancel", cancelBase.ok ? cancelBase.amount : 0, sameDay),
      323,
    );
    assert.equal(changeFeeAmount("cancel", cancelBase.ok ? cancelBase.amount : 0, free), 0);
    assert.equal(
      changeFeeAmount("reschedule", rescheduleBase.ok ? rescheduleBase.amount : 0, late),
      161.5,
    );
    assert.equal(
      changeFeeAmount("remove_dog", removeOther.ok ? removeOther.amount : 0, late),
      95,
    );

    const doubledTravel = changeFeeBase("cancel", [
      { ...daisy, travel_fee: 13 },
      { ...milo, travel_fee: 13 },
    ]);
    assert.equal(doubledTravel.ok && doubledTravel.amount, 323);

    const mirror = planTravelFeeMirror(
      [
        {
          id: "daisy",
          status: "cancelled",
          travelFee: 13,
          scheduledStart: 600,
          visitSequence: 1,
        },
        {
          id: "milo",
          status: "confirmed",
          travelFee: 0,
          scheduledStart: 660,
          visitSequence: 2,
        },
      ],
      13,
    );
    assert.deepEqual(
      mirror.map((row) => row.travelFee),
      [0, 13],
    );
  });

  it("shows the full estimate on review and the confirmed fee on the change form", () => {
    const confirm = readFileSync(
      new URL("../../components/booking/BookingConfirmStep.tsx", import.meta.url),
      "utf8",
    );
    const review = readFileSync(
      new URL("../../components/booking/BookingReviewQuote.tsx", import.meta.url),
      "utf8",
    );
    const form = readFileSync(
      new URL("../../components/account/AppointmentChangeForm.tsx", import.meta.url),
      "utf8",
    );
    assert.match(confirm, /BookingReviewQuote/);
    assert.match(review, /Estimated Total/);
    assert.match(review, /quote\.estimatedTotal/);
    assert.match(form, /serverQuote\?\.fee/);
    assert.match(form, /needsPriceReview/);
    assert.match(form, /APPLICABLE_BOOKING_TOTAL_NOTE/);
    assert.equal(form.includes("are not part of this fee"), false);
    assert.equal(form.includes("changeFeeAmount(action, estimatedTotal"), false);
  });

  it("sends Cash, Zelle, Card, and Saved Card through the same bill without a tender amount", () => {
    const stored = guestStored({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: [MINI_TRIM_ADD_ON_ID],
      petName: "Daisy",
      distanceMiles: 12,
    });
    const pet = petFrom({
      id: "daisy",
      petName: "Daisy",
      serviceName: stored.quote.serviceName,
      serviceId: stored.quote.serviceId,
      servicePrice: stored.servicePrice,
      addOnIds: [MINI_TRIM_ADD_ON_ID],
      addOnOptions: stored.addOnOptions,
    });
    const bill = billFor([pet], stored.quote.travelFee);
    assert.equal(bill.subtotal, stored.quote.estimatedTotal);
    for (const choice of [
      { tender: "cash" as const },
      { tender: "zelle" as const },
      { tender: "card" as const, useNewCard: true as const },
      {
        tender: "card" as const,
        useNewCard: false as const,
        paymentMethodId: "pm_saved",
      },
    ]) {
      const fields = buildCollectChargePaymentFields(choice);
      assert.equal("amount" in fields, false);
      assert.equal(isManualTender(fields.tender), choice.tender !== "card");
    }
  });
});

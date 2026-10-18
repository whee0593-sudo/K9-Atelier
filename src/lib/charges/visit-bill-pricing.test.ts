import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { quoteGuestBooking } from "@/lib/booking-price";
import { changeFeeAmount } from "@/lib/appointments/change-policy";
import {
  cancellationServicePortion,
  checkoutPetFromStoredRow,
  estimatedServicePortion,
  guestAppointmentPriceFields,
  staffServicePriceFields,
} from "@/lib/appointments/priced-service";
import { buildCollectChargePaymentFields } from "@/lib/charges/tender";
import { buildVisitBill, decideVisitServiceCharge } from "@/lib/charges/visit-bill";
import {
  FEE_INCLUDES_ADD_ONS_KEY,
  PRICED_ADD_ONS_KEY,
  SERVICE_PRICE_SCOPE_KEY,
  mergeVisitLineItemsIntoOptions,
  stringAddOnOptions,
} from "@/lib/charges/visit-line-items";
import { validateStaffCustomerBookingInput } from "@/lib/staff/create-customer-booking-input";
import { getUpcomingBookableDates } from "@/lib/booking-slots";

const ENDED = "2026-10-18T18:00:00.000Z";

function guestQuote() {
  const quoted = quoteGuestBooking({
    serviceId: "signature-bath-care",
    weightLbs: 12,
    addOnIds: ["dematting-brush-out", "creative-accent-coloring"],
    addOnOptions: { "creative-accent-coloring": "Temporary Fun" },
    distanceMiles: 12,
  });
  assert.equal(quoted.ok, true);
  if (!quoted.ok) throw new Error("quote failed");
  return quoted.quote;
}

function completedPet(input: {
  appointmentId: string;
  petName: string;
  serviceName: string;
  servicePrice: number | null;
  addOns?: Array<{ label: string; amount: number; catalogId?: string }>;
}) {
  return {
    appointmentId: input.appointmentId,
    petName: input.petName,
    serviceName: input.serviceName,
    servicePrice: input.servicePrice,
    status: "confirmed",
    serviceEndedAt: ENDED,
    addOns: input.addOns ?? [],
  };
}

function staffBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "5615550123",
    notifyEmail: true,
    notifySms: true,
    verbalConsent: true,
    appointmentDate: getUpcomingBookableDates(1)[0]?.value ?? "2026-10-19",
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

describe("guest booking writes a base service price and a separate add-on snapshot", () => {
  it("bills the main service, each add-on, and one travel fee", () => {
    const quote = guestQuote();
    assert.equal(quote.servicePrice, 90);
    assert.equal(quote.addOnPrice, 80);
    assert.equal(quote.estimatedServicePrice, 170);
    assert.equal(quote.travelFee, 13);
    assert.equal(quote.estimatedTotal, 183);

    const priced = guestAppointmentPriceFields(quote, quote.addOns.length
      ? { "creative-accent-coloring": "Temporary Fun" }
      : {});
    assert.equal(priced.servicePrice, quote.servicePrice);
    assert.notEqual(priced.servicePrice, quote.estimatedServicePrice);
    assert.equal(priced.estimatedTotal, quote.estimatedTotal);
    assert.deepEqual(
      priced.addOnIds,
      ["dematting-brush-out", "creative-accent-coloring"],
    );

    const checkout = checkoutPetFromStoredRow({
      serviceId: quote.serviceId,
      serviceName: quote.serviceName,
      servicePrice: priced.servicePrice,
      addOnIds: priced.addOnIds,
      addOnOptions: priced.addOnOptions,
      weightLbs: 12,
    });
    const bill = buildVisitBill({
      visitId: "visit-guest",
      customerName: "Ada Lovelace",
      serviceDate: "2026-10-19",
      arrivalLabel: "10–11 AM",
      travelFee: quote.travelFee,
      pets: [
        completedPet({
          appointmentId: "appt-bella",
          petName: "Bella",
          serviceName: checkout.serviceName ?? quote.serviceName,
          servicePrice: checkout.servicePrice,
          addOns: checkout.addOns,
        }),
      ],
    });

    assert.equal(bill.blocked, false);
    assert.equal(bill.lineItems.filter((item) => item.catalogId === "travel-fee").length, 1);
    assert.equal(bill.lineItems[0]?.amount, 90);
    assert.equal(bill.lineItems[1]?.amount, 30);
    assert.equal(bill.lineItems[2]?.amount, 50);
    assert.equal(bill.travelFee, 13);
    assert.equal(bill.subtotal, quote.estimatedTotal);
    assert.equal(
      bill.lineItems
        .filter((item) => item.catalogId !== "travel-fee")
        .reduce((sum, item) => sum + item.amount, 0),
      quote.servicePrice + quote.addOnPrice,
    );
  });

  it("does not add catalog add-ons again for a legacy guest row", () => {
    const quote = guestQuote();
    const checkout = checkoutPetFromStoredRow({
      serviceId: "signature-bath-care",
      serviceName: "Signature Bath",
      servicePrice: quote.estimatedServicePrice,
      addOnIds: ["dematting-brush-out", "creative-accent-coloring"],
      addOnOptions: { "creative-accent-coloring": "Temporary Fun" },
      weightLbs: 12,
    });
    const bill = buildVisitBill({
      visitId: "visit-legacy-guest",
      customerName: "Ada Lovelace",
      serviceDate: "2026-10-19",
      arrivalLabel: "10–11 AM",
      travelFee: quote.travelFee,
      pets: [
        completedPet({
          appointmentId: "appt-legacy",
          petName: "Bella",
          serviceName: checkout.serviceName ?? "Signature Bath",
          servicePrice: checkout.servicePrice,
          addOns: checkout.addOns,
        }),
      ],
    });
    assert.deepEqual(checkout.addOns, []);
    assert.equal(bill.subtotal, quote.estimatedServicePrice + quote.travelFee);
    assert.notEqual(bill.subtotal, quote.estimatedServicePrice + quote.addOnPrice + quote.travelFee);
  });
});

describe("staff booking keeps each dog's add-ons on that dog", () => {
  it("rejects one add-on list copied onto every dog", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          staffBody({
            serviceId: "signature-bath-care",
            addOnIds: ["dematting-brush-out"],
            pets: [
              { name: "Bella", breed: "Poodle", weightLbs: 12 },
              { name: "Max", breed: "Maltese", weightLbs: 18 },
            ],
          }),
        ),
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          "Choose add-ons for each dog. Add-ons are not applied to every dog.",
    );
  });

  it("keeps a shared list only when one dog omitted its own", () => {
    const shared = validateStaffCustomerBookingInput(
      staffBody({
        serviceId: "signature-bath-care",
        addOnIds: ["mini-trim"],
        pet: { name: "Bella", breed: "Poodle", weightLbs: 18 },
      }),
    );
    assert.deepEqual(shared.pets[0]?.addOnIds, ["mini-trim"]);

    const ownEmpty = validateStaffCustomerBookingInput(
      staffBody({
        serviceId: "signature-bath-care",
        addOnIds: ["dematting-brush-out"],
        pet: {
          name: "Bella",
          breed: "Poodle",
          weightLbs: 18,
          addOnIds: [],
        },
      }),
    );
    assert.deepEqual(ownEmpty.pets[0]?.addOnIds, []);
  });

  it("bills different add-ons per dog and travel once", () => {
    const input = validateStaffCustomerBookingInput(
      staffBody({
        pets: [
          {
            name: "Bella",
            breed: "Poodle",
            weightLbs: 12,
            serviceIds: ["signature-bath-care", "hand-stripping"],
            addOnIds: ["dematting-brush-out", "deshedding-treatment"],
          },
          {
            name: "Max",
            breed: "Maltese",
            weightLbs: 18,
            serviceId: "signature-bath-care",
            addOnIds: ["mini-trim"],
          },
        ],
      }),
    );
    assert.deepEqual(input.pets[0]?.addOnIds, [
      "dematting-brush-out",
      "deshedding-treatment",
    ]);
    assert.deepEqual(input.pets[1]?.addOnIds, ["mini-trim"]);
    assert.equal(
      input.pets[1]?.addOnIds.includes("dematting-brush-out"),
      false,
    );

    const bellaBath = staffServicePriceFields({
      serviceId: "signature-bath-care",
      servicePrice: 90,
      travelFee: 13,
      weightLbs: 12,
      optionName: null,
      addOnIds: input.pets[0]?.addOnIds ?? [],
      addOnOptions: {},
      includeAddOns: true,
    });
    const bellaStrip = staffServicePriceFields({
      serviceId: "hand-stripping",
      servicePrice: 160,
      travelFee: 0,
      weightLbs: 12,
      optionName: null,
      addOnIds: input.pets[0]?.addOnIds ?? [],
      addOnOptions: {},
      includeAddOns: false,
    });
    const maxBath = staffServicePriceFields({
      serviceId: "signature-bath-care",
      servicePrice: 110,
      travelFee: 0,
      weightLbs: 18,
      optionName: null,
      addOnIds: input.pets[1]?.addOnIds ?? [],
      addOnOptions: {},
      includeAddOns: true,
    });
    assert.equal(bellaBath.ok && bellaStrip.ok && maxBath.ok, true);
    if (!bellaBath.ok || !bellaStrip.ok || !maxBath.ok) return;

    assert.equal(bellaBath.servicePrice, 90);
    assert.equal(bellaBath.estimatedTotal, 103);
    assert.deepEqual(bellaBath.addOnIds, input.pets[0]?.addOnIds);
    assert.deepEqual(bellaStrip.addOnIds, []);
    assert.equal(bellaStrip.estimatedTotal, 160);
    assert.deepEqual(maxBath.addOnIds, ["mini-trim"]);
    assert.equal(maxBath.estimatedTotal, 110);

    const rows = [
      {
        appointmentId: "appt-bella-bath",
        petName: "Bella",
        stored: bellaBath,
        serviceId: "signature-bath-care",
        weightLbs: 12,
      },
      {
        appointmentId: "appt-bella-strip",
        petName: "Bella",
        stored: bellaStrip,
        serviceId: "hand-stripping",
        weightLbs: 12,
      },
      {
        appointmentId: "appt-max",
        petName: "Max",
        stored: maxBath,
        serviceId: "signature-bath-care",
        weightLbs: 18,
      },
    ];
    const bill = buildVisitBill({
      visitId: "visit-staff",
      customerName: "Ada Lovelace",
      serviceDate: "2026-10-19",
      arrivalLabel: "10–11 AM",
      travelFee: 13,
      pets: rows.map((row) => {
        const checkout = checkoutPetFromStoredRow({
          serviceId: row.serviceId,
          serviceName: row.petName,
          servicePrice: row.stored.servicePrice,
          addOnIds: row.stored.addOnIds,
          addOnOptions: row.stored.addOnOptions,
          weightLbs: row.weightLbs,
        });
        return completedPet({
          appointmentId: row.appointmentId,
          petName: row.petName,
          serviceName: checkout.serviceName ?? row.petName,
          servicePrice: checkout.servicePrice,
          addOns: checkout.addOns,
        });
      }),
    });

    const bellaAddOns = bill.lineItems.filter(
      (item) => item.appointmentId === "appt-bella-bath" && item.catalogId !== "visit-pet-service",
    );
    const maxAddOns = bill.lineItems.filter(
      (item) => item.appointmentId === "appt-max" && item.catalogId !== "visit-pet-service",
    );
    assert.deepEqual(
      bellaAddOns.map((item) => item.amount),
      [30, 30],
    );
    assert.deepEqual(
      maxAddOns.map((item) => item.amount),
      [35],
    );
    assert.equal(
      bill.lineItems.some(
        (item) =>
          item.appointmentId === "appt-bella-strip" &&
          item.catalogId !== "visit-pet-service",
      ),
      false,
    );
    assert.equal(bill.lineItems.filter((item) => item.catalogId === "travel-fee").length, 1);
    assert.equal(bill.subtotal, 90 + 30 + 30 + 160 + 110 + 35 + 13);
  });
});

describe("cancellation amounts stay on the previous fee base", () => {
  it("includes guest add-ons and excludes staff add-ons", () => {
    const quote = guestQuote();
    const guest = guestAppointmentPriceFields(quote, {
      "creative-accent-coloring": "Temporary Fun",
    });
    const guestPortion = cancellationServicePortion({
      service_price: guest.servicePrice,
      travel_fee: quote.travelFee,
      estimated_total: guest.estimatedTotal,
      add_on_options: guest.addOnOptions,
    });
    assert.equal(guestPortion + quote.travelFee, quote.estimatedTotal);
    assert.equal(
      changeFeeAmount("cancel", guestPortion + quote.travelFee, "late"),
      91.5,
    );
    assert.equal(
      changeFeeAmount("reschedule", quote.estimatedTotal, "same_day"),
      quote.estimatedTotal,
    );

    const legacyPortion = cancellationServicePortion({
      service_price: quote.estimatedServicePrice,
      travel_fee: quote.travelFee,
      estimated_total: quote.estimatedTotal,
      add_on_options: { "creative-accent-coloring": "Temporary Fun" },
    });
    assert.equal(legacyPortion, quote.estimatedServicePrice);

    const staff = staffServicePriceFields({
      serviceId: "signature-bath-care",
      servicePrice: 90,
      travelFee: 13,
      weightLbs: 12,
      optionName: null,
      addOnIds: ["dematting-brush-out"],
      addOnOptions: {},
      includeAddOns: true,
    });
    assert.equal(staff.ok, true);
    if (!staff.ok) return;
    assert.equal(
      cancellationServicePortion({
        service_price: staff.servicePrice,
        travel_fee: 13,
        estimated_total: staff.estimatedTotal,
        add_on_options: staff.addOnOptions,
      }),
      90,
    );
    assert.equal(
      estimatedServicePortion({
        service_price: staff.servicePrice,
        travel_fee: 13,
        estimated_total: staff.estimatedTotal,
        add_on_options: staff.addOnOptions,
      }),
      120,
    );
    assert.equal(staff.addOnOptions[FEE_INCLUDES_ADD_ONS_KEY], undefined);
  });
});

describe("stored bills and tenders", () => {
  it("keeps a manual visit line and does not reopen a paid snapshot", () => {
    const merged = mergeVisitLineItemsIntoOptions(
      {
        "creative-accent-coloring": "Temporary Fun",
        [SERVICE_PRICE_SCOPE_KEY]: "base",
        [PRICED_ADD_ONS_KEY]: [
          { id: "dematting-brush-out", label: "Gentle DeMatting", amount: 30 },
        ],
        [FEE_INCLUDES_ADD_ONS_KEY]: true,
      },
      [
        {
          id: "edited-service",
          label: "Signature Bath",
          amount: 10,
          catalogId: "signature-bath-care",
        },
      ],
    );
    const saved = merged as Record<string, unknown>;
    assert.equal(saved[SERVICE_PRICE_SCOPE_KEY], "base");
    assert.equal(saved[FEE_INCLUDES_ADD_ONS_KEY], true);
    assert.equal(stringAddOnOptions(saved)["creative-accent-coloring"], "Temporary Fun");
    assert.equal(stringAddOnOptions(saved)[PRICED_ADD_ONS_KEY], undefined);

    const checkout = checkoutPetFromStoredRow({
      serviceId: "signature-bath-care",
      serviceName: "Signature Bath",
      servicePrice: 90,
      addOnIds: ["dematting-brush-out"],
      addOnOptions: saved,
      weightLbs: 12,
    });
    assert.equal(checkout.servicePrice, 10);
    assert.deepEqual(checkout.addOns, []);

    assert.equal(
      decideVisitServiceCharge([
        {
          status: "paid",
          hasSnapshot: true,
          appointmentId: "appt-paid",
        },
      ]),
      "already_paid",
    );
  });

  it("uses one bill total for cash, Zelle, card, and saved card", () => {
    const quote = guestQuote();
    const priced = guestAppointmentPriceFields(quote, {
      "creative-accent-coloring": "Temporary Fun",
    });
    const checkout = checkoutPetFromStoredRow({
      serviceId: quote.serviceId,
      serviceName: quote.serviceName,
      servicePrice: priced.servicePrice,
      addOnIds: priced.addOnIds,
      addOnOptions: priced.addOnOptions,
      weightLbs: 12,
    });
    const bill = buildVisitBill({
      visitId: "visit-tender",
      customerName: "Ada Lovelace",
      serviceDate: "2026-10-19",
      arrivalLabel: "10–11 AM",
      travelFee: quote.travelFee,
      pets: [
        completedPet({
          appointmentId: "appt-bella",
          petName: "Bella",
          serviceName: checkout.serviceName ?? quote.serviceName,
          servicePrice: checkout.servicePrice,
          addOns: checkout.addOns,
        }),
      ],
    });
    const choices = [
      buildCollectChargePaymentFields({ tender: "cash" }),
      buildCollectChargePaymentFields({ tender: "zelle" }),
      buildCollectChargePaymentFields({ tender: "card", useNewCard: true }),
      buildCollectChargePaymentFields({
        tender: "card",
        useNewCard: false,
        paymentMethodId: "pm_saved",
      }),
    ];
    assert.deepEqual(
      choices.map((choice) => choice.tender),
      ["cash", "zelle", "card", "card"],
    );
    assert.equal(
      choices.every((choice) => !("amount" in choice)),
      true,
    );
    assert.equal(bill.subtotal, 183);
  });
});

describe("booking writers", () => {
  it("no longer copies one add-on list onto every staff appointment", () => {
    const source = readFileSync(
      new URL("../staff/create-customer-booking.ts", import.meta.url),
      "utf8",
    );
    assert.equal(source.includes("add_on_ids: input.addOnIds"), false);
    assert.match(source, /includeAddOns: visitServiceIndex === 0/);
    assert.match(source, /staffServicePriceFields\(/);
  });
});

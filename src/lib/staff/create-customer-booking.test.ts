import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allBookableServices, getServicePriceEstimate } from "@/lib/services";
import {
  StaffBookingValidationError,
  staffCreatedAccountBlockReason,
  validateCustomerConfirmInput,
  validateStaffCustomerBookingInput,
} from "@/lib/staff/create-customer-booking-input";
import {
  createCustomerConfirmToken,
  customerConfirmPath,
  hashCustomerConfirmToken,
  isAwaitingCustomerConfirm,
  isCustomerConfirmExpired,
} from "@/lib/staff/customer-confirm-token";
import { preferredPaymentMethodId } from "@/lib/staff/customer-confirm-status";
import {
  buildStaffCreatedBookingEmail,
  buildStaffCreatedBookingSms,
} from "@/lib/staff/customer-booking-copy";
import { appointmentStatusLabel } from "@/lib/appointments/map";
import type { AppointmentRecord } from "@/lib/appointments/types";
import { getUpcomingBookableDates } from "@/lib/booking-slots";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "5615550123",
    notifyEmail: true,
    notifySms: true,
    verbalConsent: true,
    pet: {
      name: "Bella",
      breed: "Poodle",
      weightLbs: 18,
    },
    serviceId: "signature-bath-care",
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

function sampleAppointment(): AppointmentRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    customerId: "22222222-2222-4222-8222-222222222222",
    petId: "33333333-3333-4333-8333-333333333333",
    petName: "Bella",
    petBreed: "Poodle",
    serviceId: "signature-bath-care",
    serviceName: "Signature Bath & Care",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "100 Olive Ave",
    addressCity: "West Palm Beach",
    addressState: "FL",
    addressZip: "33401",
    travelDistanceMiles: 4,
    travelFee: 0,
    appointmentDate: "2026-09-18",
    appointmentTime: "10–11 AM",
    scheduledStart: 600,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: 95,
    newClientDeposit: 0,
    vaccinationStatusAtBooking: "missing",
    status: "pending_confirmation",
    confirmedAt: null,
    customerConfirmedAt: null,
    staffCreated: true,
    awaitingCustomerConfirm: true,
    createdAt: "2026-09-13T12:00:00.000Z",
  };
}

describe("staffCreatedAccountBlockReason", () => {
  it("blocks the owner email", () => {
    assert.equal(
      staffCreatedAccountBlockReason("Penny@k9atelier.com"),
      "Use a customer email, not the owner account.",
    );
  });

  it("allows a customer email", () => {
    assert.equal(staffCreatedAccountBlockReason("ada@example.com"), null);
  });
});

describe("validateStaffCustomerBookingInput", () => {
  it("lets an admin confirm a schedule conflict instead of treating it as missing", () => {
    assert.equal(
      validateStaffCustomerBookingInput(validBody()).acknowledgeScheduleConflict,
      false,
    );
    assert.equal(
      validateStaffCustomerBookingInput(
        validBody({ acknowledgeScheduleConflict: true }),
      ).acknowledgeScheduleConflict,
      true,
    );
  });

  it("accepts a complete staff booking", () => {
    const input = validateStaffCustomerBookingInput(validBody());
    assert.equal(input.mode, "booking");
    assert.equal(input.email, "ada@example.com");
    assert.equal(input.phone, "+15615550123");
    assert.ok((input.serviceName?.length ?? 0) > 0);
    assert.equal(input.pets.length, 1);
    assert.equal(input.pets[0]?.name, "Bella");
  });

  it("keeps a saved pet id so an existing dog is reused", () => {
    const petId = "33333333-3333-4333-8333-333333333333";
    const input = validateStaffCustomerBookingInput(
      validBody({
        pets: [{ id: petId, name: "Bella", breed: "Poodle", weightLbs: 18 }],
      }),
    );
    assert.equal(input.pets[0]?.id, petId);
    assert.equal(input.pets[0]?.name, "Bella");
  });

  it("rejects a pet id that is not a customer file id", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({
            pets: [{ id: "not-a-pet", name: "Bella", breed: "Poodle", weightLbs: 18 }],
          }),
        ),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.message === "Pet not found.",
    );
  });

  it("accepts multiple dog profiles", () => {
    const input = validateStaffCustomerBookingInput(
      validBody({
        pets: [
          { name: "Bella", breed: "Poodle", weightLbs: 18 },
          { name: "Max", breed: "Maltese", weightLbs: 12 },
        ],
      }),
    );
    assert.equal(input.pets.length, 2);
    assert.equal(input.pets[1]?.name, "Max");
    assert.equal(input.pets[0]?.serviceId, "signature-bath-care");
    assert.equal(input.pets[1]?.serviceId, "signature-bath-care");
    assert.deepEqual(input.pets[0]?.serviceIds, ["signature-bath-care"]);
    assert.deepEqual(input.pets[1]?.serviceIds, ["signature-bath-care"]);
  });

  it("keeps a different service on each dog", () => {
    const input = validateStaffCustomerBookingInput(
      validBody({
        serviceId: undefined,
        pets: [
          {
            name: "Luna",
            breed: "Poodle",
            weightLbs: 14,
            serviceId: "signature-bath-care",
          },
          {
            name: "Max",
            breed: "Maltese",
            weightLbs: 11,
            serviceId: "custom-full-haircut",
          },
        ],
      }),
    );
    assert.equal(input.mode, "booking");
    assert.equal(input.pets[0]?.serviceId, "signature-bath-care");
    assert.equal(input.pets[1]?.serviceId, "custom-full-haircut");
    assert.deepEqual(input.pets[1]?.serviceIds, ["custom-full-haircut"]);
    assert.equal(input.serviceId, "signature-bath-care");
    assert.equal(input.serviceName, "Signature Bath & Care");
  });

  it("accepts two different services for the same dog", () => {
    const input = validateStaffCustomerBookingInput(
      validBody({
        serviceId: undefined,
        pet: {
          name: "Luna",
          breed: "Poodle",
          weightLbs: 14,
          serviceIds: ["hand-stripping", "signature-bath-care"],
        },
      }),
    );
    assert.equal(input.mode, "booking");
    assert.equal(input.pets.length, 1);
    assert.deepEqual(input.pets[0]?.serviceIds, [
      "hand-stripping",
      "signature-bath-care",
    ]);
    assert.equal(input.serviceId, "hand-stripping");
  });

  it("accepts as many services as the dog needs", () => {
    const serviceIds = [
      "signature-bath-care",
      "long-coat-show-care",
      "dead-sea-mud-bath",
      "aromatherapy-oil-bath",
      "sensitive-skin-treatment",
      "custom-full-haircut",
    ];
    const input = validateStaffCustomerBookingInput(
      validBody({
        serviceId: undefined,
        pet: {
          name: "Luna",
          breed: "Poodle",
          weightLbs: 14,
          serviceIds,
        },
      }),
    );
    assert.deepEqual(input.pets[0]?.serviceIds, serviceIds);
  });

  it("keeps every coloring style selectable", () => {
    const input = validateStaffCustomerBookingInput(
      validBody({
        serviceId: undefined,
        pet: {
          name: "Luna",
          breed: "Poodle",
          weightLbs: 14,
          serviceIds: [
            "creative-accent-coloring::Ears & Tail Accent",
            "creative-accent-coloring::Paws & Boots Accent",
          ],
        },
      }),
    );
    assert.deepEqual(input.pets[0]?.serviceIds, [
      "creative-accent-coloring",
      "creative-accent-coloring",
    ]);
    assert.deepEqual(input.pets[0]?.serviceOptionNames, [
      "Ears & Tail Accent",
      "Paws & Boots Accent",
    ]);
    assert.equal(input.serviceName, "Creative coloring/Ears & Tail Accent");
    const coloring = allBookableServices().find(
      (service) => service.id === "creative-accent-coloring",
    );
    assert.ok(coloring);
    assert.equal(
      getServicePriceEstimate(coloring, 14, "Temporary Fun")?.from,
      50,
    );
    assert.equal(
      getServicePriceEstimate(coloring, 14, "Ears & Tail Accent")?.from,
      100,
    );
    assert.equal(
      getServicePriceEstimate(coloring, 14, "Paws & Boots Accent")?.from,
      350,
    );
    assert.equal(
      getServicePriceEstimate(coloring, 14, "Custom Creative Design"),
      null,
    );
    const priced = validateStaffCustomerBookingInput(
      validBody({
        serviceId: undefined,
        pet: {
          name: "Luna",
          breed: "Poodle",
          weightLbs: 14,
          serviceIds: [
            "signature-bath-care",
            "creative-accent-coloring::Custom Creative Design",
          ],
          servicePrices: [null, 240],
        },
      }),
    );
    assert.deepEqual(priced.pets[0]?.servicePrices, [null, 240]);
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({
            serviceId: undefined,
            pet: {
              name: "Luna",
              breed: "Poodle",
              weightLbs: 14,
              serviceIds: ["creative-accent-coloring::Custom Creative Design"],
            },
          }),
        ),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.message === "Enter a price for Custom Creative Design.",
    );
    assert.equal(getServicePriceEstimate(coloring, 14), null);
  });

  it("names spa, specialty, and add-on rows by their category", () => {
    const input = validateStaffCustomerBookingInput(
      validBody({
        serviceId: undefined,
        pet: {
          name: "Luna",
          breed: "Poodle",
          weightLbs: 14,
          serviceIds: [
            "dead-sea-mud-bath",
            "senior-comfort-care",
            "dematting-brush-out",
          ],
        },
      }),
    );
    assert.equal(input.serviceName, "SPA/Dead Sea Mud Bath Treatment");
    assert.deepEqual(input.pets[0]?.serviceIds, [
      "dead-sea-mud-bath",
      "senior-comfort-care",
      "dematting-brush-out",
    ]);
  });

  it("rejects coloring until a style is chosen", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({
            serviceId: undefined,
            pet: {
              name: "Luna",
              breed: "Poodle",
              weightLbs: 14,
              serviceIds: ["creative-accent-coloring"],
            },
          }),
        ),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.message === "Choose a bookable grooming service.",
    );
  });

  it("rejects the same service twice for one dog", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({
            serviceId: undefined,
            pet: {
              name: "Luna",
              breed: "Poodle",
              weightLbs: 14,
              serviceIds: ["signature-bath-care", "signature-bath-care"],
            },
          }),
        ),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.message === "Choose a different service for this dog.",
    );
  });

  it("rejects a service that the dog's weight cannot book", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({
            serviceId: undefined,
            pets: [
              {
                name: "Luna",
                breed: "Poodle",
                weightLbs: 14,
                serviceId: "signature-bath-care",
              },
              {
                name: "Bear",
                breed: "Airedale",
                weightLbs: 60,
                serviceId: "custom-full-haircut",
              },
            ],
          }),
        ),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.field === "pets[1].serviceIds[0]",
    );
  });

  it("accepts an email-only invite with no other fields", () => {
    const input = validateStaffCustomerBookingInput({
      email: "ada@example.com",
    });
    assert.equal(input.mode, "invite");
    assert.equal(input.email, "ada@example.com");
    assert.equal(input.phone, null);
    assert.equal(input.notifyEmail, true);
    assert.equal(input.pets.length, 0);
  });

  it("accepts a phone-only invite with no other fields", () => {
    const input = validateStaffCustomerBookingInput({
      phone: "5615550123",
    });
    assert.equal(input.mode, "invite");
    assert.equal(input.phone, "+15615550123");
    assert.equal(input.email, null);
    assert.equal(input.notifySms, true);
  });

  it("requires email or phone", () => {
    assert.throws(
      () => validateStaffCustomerBookingInput({ firstName: "Ada" }),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.field === "contact",
    );
  });

  it("rejects the owner email", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({ email: "penny@k9atelier.com" }),
        ),
      StaffBookingValidationError,
    );
  });

  it("rejects dogs over 45 lbs for a bath service", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({
            pet: { name: "Bear", breed: "Lab", weightLbs: 60 },
          }),
        ),
      StaffBookingValidationError,
    );
  });
});

describe("validateCustomerConfirmInput", () => {
  it("requires a 64-character token and policy acceptance", () => {
    const token = "a".repeat(64);
    const input = validateCustomerConfirmInput({
      token,
      acceptPolicies: true,
      password: "secret123",
    });
    assert.equal(input.token, token);
    assert.equal(input.password, "secret123");
    assert.equal(input.paymentMethodId, null);
  });

  it("accepts a saved card id and rejects a malformed one", () => {
    const token = "b".repeat(64);
    const paymentMethodId = "22222222-2222-4222-8222-222222222222";
    const input = validateCustomerConfirmInput({
      token,
      acceptPolicies: true,
      paymentMethodId,
    });
    assert.equal(input.paymentMethodId, paymentMethodId);
    assert.throws(
      () =>
        validateCustomerConfirmInput({
          token,
          acceptPolicies: true,
          paymentMethodId: "not-a-card",
        }),
      StaffBookingValidationError,
    );
  });

  it("prefers the default card when securing a staff booking", () => {
    assert.equal(
      preferredPaymentMethodId([
        { id: "older", isDefault: false },
        { id: "default-card", isDefault: true },
      ]),
      "default-card",
    );
    assert.equal(preferredPaymentMethodId([]), null);
  });

  it("rejects a short password", () => {
    assert.throws(
      () =>
        validateCustomerConfirmInput({
          token: "a".repeat(64),
          acceptPolicies: true,
          password: "short",
        }),
      StaffBookingValidationError,
    );
  });
});

describe("customer confirm tokens", () => {
  it("hashes the same token consistently", () => {
    const { token, hash } = createCustomerConfirmToken();
    assert.equal(hashCustomerConfirmToken(token), hash);
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(customerConfirmPath(token), `/confirm-account?token=${token}`);
  });

  it("treats missing or past expiry as expired", () => {
    assert.equal(isCustomerConfirmExpired(null), true);
    assert.equal(
      isCustomerConfirmExpired("2020-01-01T00:00:00.000Z", Date.parse("2026-09-13")),
      true,
    );
    assert.equal(
      isCustomerConfirmExpired("2026-09-20T00:00:00.000Z", Date.parse("2026-09-13")),
      false,
    );
  });

  it("marks staff-created pending bookings as awaiting confirm", () => {
    assert.equal(
      isAwaitingCustomerConfirm({
        staff_created: true,
        customer_confirm_token_hash: "abc",
        status: "pending_confirmation",
      }),
      true,
    );
    assert.equal(
      isAwaitingCustomerConfirm({
        staff_created: true,
        customer_confirm_token_hash: null,
        status: "confirmed",
      }),
      false,
    );
  });
});

describe("staff-created booking copy", () => {
  it("includes the confirmation URL in email and SMS", () => {
    const appointment = sampleAppointment();
    const confirmUrl = "https://k9atelier.com/confirm-account?token=abc";
    const email = buildStaffCreatedBookingEmail(appointment, {
      firstName: "Ada",
      confirmUrl,
      createdAccount: true,
    });
    assert.match(email.subject, /confirm/i);
    assert.match(email.text, /confirm-account\?token=abc/);
    assert.match(email.html, /Review and Confirm/);
    assert.match(email.text, /Rabies vaccination details are optional/);
    assert.match(email.text, /card on file/);
    assert.match(email.text, /secure this appointment/);
    const sms = buildStaffCreatedBookingSms(appointment, confirmUrl);
    assert.match(sms, /add a card to secure/i);
    assert.match(sms, /Bella/);
    assert.match(sms, /confirm-account\?token=abc/);
    const multiSms = buildStaffCreatedBookingSms(appointment, confirmUrl, [
      "Bella",
      "Max",
    ]);
    assert.match(multiSms, /Bella and Max/);
  });
});

describe("appointmentStatusLabel", () => {
  it("labels staff-created bookings waiting on the customer", () => {
    assert.equal(
      appointmentStatusLabel("pending_confirmation", true),
      "Awaiting Customer Confirmation",
    );
    assert.equal(
      appointmentStatusLabel("pending_confirmation"),
      "Pending Review",
    );
  });
});

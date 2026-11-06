import { staffAppointmentPriceDrafts } from "@/lib/staff/staff-appointment-drafts";
import { fixedPriceForService, mapFixedServicePrices } from "@/lib/pets/fixed-prices";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  allBookableServices,
  getServicePriceEstimate,
  MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
} from "@/lib/services";
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
  staffCreatedVisitDetailRows,
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
  beforeEach((t) => t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-26T12:00:00Z") }));
  it("allows staff to book Saturday and Sunday without changing public weekdays", () => {
    for (const appointmentDate of ["2026-10-31", "2026-11-01"]) {
      const result = validateStaffCustomerBookingInput(validBody({ appointmentDate, slotStartMinutes: 600 }));
      assert.equal(result.appointmentDate, appointmentDate);
    }
  });

  it("accepts today's 2 PM booking at 12:24 PM and rejects elapsed starts", (t) => {
    t.mock.timers.setTime(new Date("2026-10-26T16:24:00Z").getTime());
    assert.equal(validateStaffCustomerBookingInput(validBody({ appointmentDate: "2026-10-26", slotStartMinutes: 840 })).mode, "booking");
    assert.throws(() => validateStaffCustomerBookingInput(validBody({ appointmentDate: "2026-10-26", slotStartMinutes: 720 })), /has not passed/);
  });
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
    assert.equal(input.serviceName, "Signature Bath");
  });

  it("rejects a second Mini Trim charge on a service that already includes it", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({
            serviceId: undefined,
            pet: {
              name: "Luna",
              breed: "Poodle",
              weightLbs: 14,
              serviceIds: ["show-level-coat-care", "mini-trim"],
            },
          }),
        ),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.message === MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
    );
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({
            serviceId: "luxury-spa-day",
            addOnIds: ["mini-trim"],
          }),
        ),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.field === "addOnIds",
    );
    const bath = validateStaffCustomerBookingInput(
      validBody({
        serviceId: undefined,
        pet: {
          name: "Luna",
          breed: "Poodle",
          weightLbs: 14,
          serviceIds: ["signature-bath-care", "mini-trim"],
        },
      }),
    );
    assert.deepEqual(bath.pets[0]?.serviceIds, [
      "signature-bath-care",
      "mini-trim",
    ]);
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
      "luxury-spa-day",
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
    assert.deepEqual(input.pets[0]?.serviceIds, [
      "signature-bath-care",
      "show-level-coat-care",
      "luxury-spa-day",
      "custom-full-haircut",
    ]);
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
            "luxury-spa-day",
            "senior-comfort-care",
            "dematting-brush-out",
          ],
        },
      }),
    );
    assert.equal(input.serviceName, "Luxury Spa Day");
    assert.deepEqual(input.pets[0]?.serviceIds, [
      "luxury-spa-day",
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

  it("accepts services regardless of the dog's weight and retains edited prices", () => {
    const input = validateStaffCustomerBookingInput(validBody({
      serviceId: undefined,
      pets: [{name: "Bear", breed: "Lab", weightLbs: 60, serviceIds: ["signature-bath-care", "custom-full-haircut"], servicePrices: [135.5, 0]}],
    }));
    assert.deepEqual(input.pets[0].servicePrices, [135.5, 0]);
    assert.equal(input.mode, "booking");
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

  it("never silently turns a dated booking into an invitation", () => {
    for (const overrides of [
      { serviceId: "" },
      { address: undefined },
      { slotStartMinutes: undefined },
      { appointmentDate: undefined },
      { pet: undefined },
      { appointmentDate: undefined, slotStartMinutes: undefined, bookingIntent: true },
    ]) {
      assert.throws(
        () => validateStaffCustomerBookingInput(validBody(overrides)),
        (error: unknown) => error instanceof StaffBookingValidationError && /No appointment has been created/.test(error.message),
      );
    }
  });

  it("requires a text confirmation channel for a complete staff booking", () => {
    for (const overrides of [{ phone: "", notifySms: false }, { notifySms: false, notifyEmail: true }]) {
      assert.throws(() => validateStaffCustomerBookingInput(validBody(overrides)), /reply C/);
    }
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

  it("accepts dogs over 45 lbs for a bath service", () => {
    assert.equal(validateStaffCustomerBookingInput(validBody({pet: {name: "Bear", breed: "Lab", weightLbs: 60}})).mode, "booking");
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
    assert.equal(isAwaitingCustomerConfirm({ staff_created: true, customer_confirm_token_hash: null, status: "pending_confirmation" }), true);
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
    assert.match(email.text, /confirm-account\/appointment\?token=abc/);
    assert.match(email.html, />Confirm<\/a>/);
    assert.doesNotMatch(email.text, /You can use the link below|Rabies vaccination details are optional|Review details/i);
    assert.match(email.text, /click the button below to confirm/);
    assert.doesNotMatch(email.text, /card on file is required to secure/);
    const sms = buildStaffCreatedBookingSms(appointment, confirmUrl);
    assert.match(sms, /reply C to confirm/i);
    assert.match(sms, /Bella/);
    assert.doesNotMatch(sms, /https?:|confirm-account|confirm online|save your details/i);
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

it("uses direct email confirmation while retaining the separate SMS profile flow", () => {
  const appointment = sampleAppointment();
  const confirmUrl = "https://k9atelier.com/confirm-account?token=example";
  const email = buildStaffCreatedBookingEmail(appointment, {firstName:"Daniel",confirmUrl,createdAccount:false,requiresProfileCompletion:true});
  assert.match(email.text, /^Dear Daniel,/);
  assert.match(email.html, />Dear Daniel,</);
  assert.match(email.text, /Please review the details of your appointment with K9 Atelier and click the button below to confirm\./);
  assert.match(email.html, /href="https:\/\/k9atelier.com\/confirm-account\/appointment\?token=example"/);
  assert.doesNotMatch(email.html, /You can use the link below|Review Details|complete your profile|reply C/i);
  assert.doesNotMatch(email.text, /Please click the button below to complete your profile and confirm your appointment/);
  assert.doesNotMatch(email.html, /Please click the button below to complete your profile and confirm your appointment/);
  assert.doesNotMatch(email.text, /reply C|securely saved|Looking forward|card on file/i);
  for (const petNames of [["Molly"],["Molly","Daisy"],["Molly","Daisy","Milo"]]) {
    const sms = buildStaffCreatedBookingSms(appointment, confirmUrl, petNames, {firstName:"Daniel",requiresProfileCompletion:true});
    assert.match(sms, /^K9 Atelier reserved an appointment for /);
    assert.doesNotMatch(sms, /complete your profile|https?:|confirm-account|confirm online|save your details/i);
    assert.match(sms, /Reply STOP to opt out/);
    assert.match(sms, /Please reply C to confirm your appointment\./);
    for (const petName of petNames) assert.ok(sms.includes(petName));
  }
});

it("orders visit details before pets and totals all services in both staff email formats", () => {
  const first = { ...sampleAppointment(), visitId: "shared", petName: "LYCHEE", estimatedTotal: 140, scheduledStart: 840, estimatedDurationMinutes: 83, appointmentTime: "2:00–3:23 PM" };
  const second = { ...first, id: "second", petId: "yoyo", petName: "YOYO", serviceName: "Signature Bath", scheduledStart: 923, estimatedDurationMinutes: 60, appointmentTime: "3:23–4:23 PM", estimatedTotal: 80 };
  assert.deepEqual(staffCreatedVisitDetailRows(first, [second, first]).map(([label]) => label), ["Date & Time", "Estimated Service Duration", "Address", "Pet", "Services", "Pet", "Services", "Estimated Total"]);
  for (const requiresProfileCompletion of [false, true]) {
    const email = buildStaffCreatedBookingEmail(first, { firstName: "Penny", confirmUrl: "https://example.com/confirm", createdAccount: false, requiresProfileCompletion }, [second, first]);
    for (const body of [email.text, email.html]) {
      for (const value of ["LYCHEE", "YOYO", "Signature Bath", "2:00 PM", "2 hr 23 min", "$220"]) assert.ok(body.includes(value), value);
      assert.doesNotMatch(body, /Pet estimate|Travelling Fee|Complimentary|3:23–4:23 PM|\$140|\$80/);
    }
  }
  const unrelated = { ...second, visitId: "other", petName: "Unrelated" };
  assert.ok(!buildStaffCreatedBookingEmail(first, { firstName: "Penny", confirmUrl: "https://example.com", createdAccount: false }, [first, unrelated]).text.includes("Unrelated"));
});

it("combines multiple services per pet, includes paid travel once and excludes cancelled dogs", () => {
  const first = { ...sampleAppointment(), visitId: "shared", estimatedTotal: 140.25, travelFee: 10, estimatedDurationMinutes: 60 };
  const extra = { ...first, id: "extra", serviceName: "Extra Care", estimatedTotal: 20.1, travelFee: 0, estimatedDurationMinutes: 15 };
  const third = { ...first, id: "third", petId: "third", petName: "Third", estimatedTotal: 30, travelFee: 0 };
  const cancelled = { ...third, id: "cancelled", petId: "cancelled", petName: "Cancelled", status: "cancelled" as const };
  const rows = staffCreatedVisitDetailRows(first, [first, extra, third, cancelled]);
  assert.equal(rows.filter(([label]) => label === "Pet").length, 2);
  assert.ok(rows.find(([label]) => label === "Services")![1].includes("Extra Care"));
  assert.deepEqual(rows.slice(-2), [["Travelling Fee", "$10"], ["Estimated Total", "From $190.35"]]);
  assert.ok(!JSON.stringify(rows).includes("Cancelled"));
  const single = staffCreatedVisitDetailRows(first, [first]);
  assert.equal(single[0]![0], "Date & Time");
  assert.equal(single[1]![1], "1 hr");
  const unknown = staffCreatedVisitDetailRows({...first, estimatedDurationMinutes: null, estimatedTotal: null}, []);
  assert.equal(unknown[1]![1], "To be confirmed");
  assert.equal(unknown.at(-1)![1], "To be confirmed");
});

it("uses the website purple for Confirm and sends the exact link-free visit SMS", () => {
  const appointment = { ...sampleAppointment(), scheduledStart: 840, appointmentDate: "2026-11-10", appointmentTime: "2:00–3:23 PM" };
  const expected = "K9 Atelier reserved an appointment for LYCHEE and YOYO on Tuesday, November 10, 2026 2:00 PM. Please reply C to confirm your appointment. Reply STOP to opt out.";
  for (const requiresProfileCompletion of [false, true]) {
    assert.equal(buildStaffCreatedBookingSms(appointment, "https://example.com/private-token", ["LYCHEE", "YOYO"], { firstName: "Penny", requiresProfileCompletion }), expected);
  }
  const email = buildStaffCreatedBookingEmail(appointment, {firstName:"Penny",confirmUrl:"https://example.com/confirm-account?token=preview",createdAccount:false});
  const button = email.html.match(/<a[^>]*>Confirm<\/a>/)?.[0] ?? "";
  assert.match(button, /background-color:#6b596e/);
  assert.match(button, /color:#FAF7F2/);
  assert.ok(buildStaffCreatedBookingSms(appointment, "unused", ["LYCHEE", "YOYO", "MILO"]).includes("LYCHEE, YOYO, and MILO"));
});

 it("uses edited prices ahead of saved fixed prices in appointment and notification estimates", () => {
   const priced = staffAppointmentPriceDrafts([{
     weightLbs: 60, serviceIds: ["signature-bath-care", "mini-trim"], serviceOptionNames: [null, null],
     servicePrices: [135.5, 0], fixedServicePrices: {"signature-bath-care": 95, "mini-trim": 30},
     addOnIds: [], addOnOptions: {},
   }], 10);
   assert.ok(priced.ok);
   const drafts = priced.drafts;
   assert.deepEqual(drafts.map(row => row.servicePrice), [135.5, 0]);
   assert.deepEqual(drafts.map(row => row.estimatedTotal), [145.5, 0]);
   const appointments = drafts.map((row, i) => ({...sampleAppointment(), id: String(i), visitId: "visit", serviceId: row.serviceId, serviceName: row.serviceName, servicePrice: row.servicePrice, estimatedTotal: row.estimatedTotal, travelFee: row.travelFee}));
   const notice = {firstName: "Ada", confirmUrl: "https://k9atelier.com/confirm-account?token=test", createdAccount: false};
   assert.match(buildStaffCreatedBookingEmail(appointments[0], notice, appointments).text, /145.50/);

   const prices = mapFixedServicePrices([{service_id: "signature-bath-care", amount: 135.5}, {service_id: "mini-trim", amount: 0}]);
   assert.equal(fixedPriceForService(prices, "mini-trim"), 0);
   assert.equal(fixedPriceForService(prices, "signature-bath-care"), 135.5);
 });

it("requires a staff quote when an unrestricted service has no weight-tier price", () => {
  const priced = staffAppointmentPriceDrafts([{weightLbs: 60, serviceIds: ["signature-bath-care"], serviceOptionNames: [null], servicePrices: [null], addOnIds: [], addOnOptions: {}}], 0);
  assert.equal(priced.ok, false);
});

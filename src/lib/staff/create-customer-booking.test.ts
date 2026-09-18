import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
  it("accepts a complete staff booking", () => {
    const input = validateStaffCustomerBookingInput(validBody());
    assert.equal(input.email, "ada@example.com");
    assert.equal(input.phone, "+15615550123");
    assert.equal(input.serviceName.length > 0, true);
    assert.equal(input.pet.name, "Bella");
  });

  it("requires a notify channel", () => {
    assert.throws(
      () =>
        validateStaffCustomerBookingInput(
          validBody({ notifyEmail: false, notifySms: false }),
        ),
      (error: unknown) =>
        error instanceof StaffBookingValidationError &&
        error.field === "notify",
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
    assert.match(email.html, /CONFIRM APPOINTMENT/);
    assert.match(email.text, /rabies vaccination status/);
    assert.match(email.text, /You may also add a card on file/);
    const sms = buildStaffCreatedBookingSms(appointment, confirmUrl);
    assert.match(sms, /Bella/);
    assert.match(sms, /confirm-account\?token=abc/);
  });
});

describe("appointmentStatusLabel", () => {
  it("labels staff-created bookings waiting on the customer", () => {
    assert.equal(
      appointmentStatusLabel("pending_confirmation", true),
      "Awaiting Customer Confirmation",
    );
  });
});

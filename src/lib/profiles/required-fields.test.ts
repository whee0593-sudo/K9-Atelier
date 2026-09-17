import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  AppointmentValidationError,
  validateCreateAppointmentInput,
} from "@/lib/appointments/validation";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import {
  formatMissingProfileFieldsMessage,
  missingCustomerProfileFieldLabels,
  ProfileValidationError,
  validateProfileWriteInput,
} from "@/lib/profiles/validation";

function validAppointmentBody(overrides: Record<string, unknown> = {}) {
  const appointmentDate =
    getUpcomingBookableDates(1)[0]?.value ?? "2026-09-18";
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
    estimatedTotal: 95,
    paymentMethodId: "22222222-2222-4222-8222-222222222222",
    customerPhone: "5613466778",
    customerFirstName: "Tia",
    customerLastName: "Francavilla",
    smsConsent: true,
    photoMarketingConsent: true,
    servicePoliciesConsent: true,
    ...overrides,
  };
}

describe("required customer profile fields", () => {
  it("lists every blank required column", () => {
    assert.deepEqual(
      missingCustomerProfileFieldLabels({
        firstName: "",
        lastName: "   ",
        email: "tiafrancavilla@gmail.com",
        phone: "+15613466778",
      }),
      ["First Name", "Last Name"],
    );
  });

  it("names the missing columns when a profile cannot be saved", () => {
    assert.equal(
      formatMissingProfileFieldsMessage(["First Name", "Last Name"]),
      "This profile cannot be saved until you complete: First Name, Last Name.",
    );
    assert.equal(
      formatMissingProfileFieldsMessage(["First Name", "Last Name"], "staff"),
      "Complete these fields to save this customer file: First Name, Last Name.",
    );
  });

  it("rejects a profile write that omits first and last name", () => {
    assert.throws(
      () =>
        validateProfileWriteInput({
          firstName: "",
          lastName: "",
          phone: "+15613466778",
        }),
      (error: unknown) =>
        error instanceof ProfileValidationError &&
        error.message ===
          "This profile cannot be saved until you complete: First Name, Last Name.",
    );
  });

  it("accepts a complete required profile", () => {
    const input = validateProfileWriteInput({
      firstName: "Tia",
      lastName: "Francavilla",
      phone: "5613466778",
    });
    assert.equal(input.firstName, "Tia");
    assert.equal(input.lastName, "Francavilla");
    assert.equal(input.phone, "+15613466778");
  });

  it("rejects a booking that omits first and last name", () => {
    assert.throws(
      () =>
        validateCreateAppointmentInput(
          validAppointmentBody({
            customerFirstName: "  ",
            customerLastName: "",
          }),
        ),
      (error: unknown) =>
        error instanceof AppointmentValidationError &&
        error.message === "First Name is required.",
    );
  });

  it("accepts a booking that includes first and last name", () => {
    const input = validateCreateAppointmentInput(validAppointmentBody());
    assert.equal(input.customerFirstName, "Tia");
    assert.equal(input.customerLastName, "Francavilla");
  });

  it("saves staff edits to a customer file with the admin client", () => {
    const source = readFileSync(
      new URL("./service.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /export async function updateStaffCustomerProfile/);
    assert.match(source, /createAdminClient\(\)/);
    assert.doesNotMatch(
      source,
      /updateStaffCustomerProfile[\s\S]*createAuthenticatedSupabaseClient/,
    );
  });
});

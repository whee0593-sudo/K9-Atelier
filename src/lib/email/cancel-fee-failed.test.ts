import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppointmentRecord } from "../appointments/types";
import {
  buildCancelFeeFailedEmail,
  buildCancelFeeFailedEmailContent,
  cancelPaymentUpdateUrl,
} from "./cancel-fee-failed";

function appointment(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: "apt-1",
    customerId: "cust-1",
    petId: "pet-1",
    petName: "Maple",
    petBreed: "Cavapoo",
    serviceId: "signature-bath-care",
    serviceName: "Signature Bath & Care",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "1408 14th Lane",
    addressCity: "Palm Beach Gardens",
    addressState: "FL",
    addressZip: "33418",
    travelDistanceMiles: 8,
    travelFee: 0,
    appointmentDate: "2026-08-24",
    appointmentTime: "10:00–12:00 PM",
    scheduledStart: null,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: 140,
    newClientDeposit: null,
    vaccinationStatusAtBooking: null,
    status: "cancelled",
    confirmedAt: null,
    customerConfirmedAt: null,
    createdAt: "2026-08-20T14:00:00.000Z",
    ...patch,
  };
}

const alex = {
  email: "alex@example.com",
  name: "Alex Rivera",
  firstName: "Alex",
};

describe("cancel fee failed email", () => {
  it("uses Action Needed in the subject and never says the fee was charged", () => {
    const content = buildCancelFeeFailedEmailContent({
      appointment: appointment(),
      customer: alex,
      fee: 70,
    });
    assert.equal(
      content.subject,
      "Action Needed: Cancellation Fee for Maple’s Appointment",
    );
    assert.match(content.text, /fee of \$70\.00/);
    assert.equal((content.text.match(/\$70\.00/g) ?? []).length, 1);
    assert.doesNotMatch(content.text, /has been charged/);
    assert.doesNotMatch(content.text, /You failed to pay|invalid|violation/i);
  });

  it("formats morning, afternoon, noon-crossing, and midnight-crossing times", () => {
    assert.match(
      buildCancelFeeFailedEmailContent({
        appointment: appointment({ appointmentTime: "9:00–10:30 AM" }),
        customer: alex,
        fee: 70,
      }).text,
      /9:00 AM–10:30 AM/,
    );
    assert.match(
      buildCancelFeeFailedEmailContent({
        appointment: appointment({ appointmentTime: "1:00–3:00 PM" }),
        customer: alex,
        fee: 70,
      }).text,
      /1:00 PM–3:00 PM/,
    );
    assert.match(
      buildCancelFeeFailedEmailContent({
        appointment: appointment({ appointmentTime: "11:00–1:00 PM" }),
        customer: alex,
        fee: 70,
      }).text,
      /11:00 AM–1:00 PM/,
    );
    assert.match(
      buildCancelFeeFailedEmailContent({
        appointment: appointment({ appointmentTime: "11:00 PM–1:00 AM" }),
        customer: alex,
        fee: 70,
      }).text,
      /11:00 PM–1:00 AM/,
    );
  });

  it("names one pet or several pets from dynamic data", () => {
    const multi = buildCancelFeeFailedEmailContent({
      appointment: appointment(),
      customer: alex,
      petNames: ["Maple", "Otto"],
      fee: 182.5,
    });
    assert.match(multi.text, /Your appointment for Maple and Otto has been canceled/);
    assert.match(multi.subject, /Maple’s Appointment/);
  });

  it("shows a customer-safe decline or expiry reason, never an internal code", () => {
    const declined = buildCancelFeeFailedEmailContent({
      appointment: appointment(),
      customer: alex,
      fee: 70,
      paymentFailureKind: "declined",
    });
    const expired = buildCancelFeeFailedEmailContent({
      appointment: appointment(),
      customer: alex,
      fee: 70,
      paymentFailureKind: "expired",
    });
    const unknown = buildCancelFeeFailedEmailContent({
      appointment: appointment(),
      customer: alex,
      fee: 70,
    });
    assert.match(declined.text, /Payment method declined/);
    assert.match(expired.text, /Payment method expired/);
    assert.doesNotMatch(unknown.text, /Payment method declined/);
    assert.doesNotMatch(declined.text, /card_declined|pi_/);
  });

  it("explains an automatic retry and does not demand a card update", () => {
    const content = buildCancelFeeFailedEmailContent({
      appointment: appointment(),
      customer: alex,
      fee: 70,
      willAutoRetry: true,
    });
    assert.match(content.text, /We will automatically retry the payment/);
    assert.doesNotMatch(content.text, /Please update your payment method to complete the payment/);
  });

  it("uses the authenticated payment page as the primary button", () => {
    assert.match(cancelPaymentUpdateUrl(), /\/account\/payment$/);
    const email = buildCancelFeeFailedEmail({
      appointment: appointment(),
      customer: alex,
      fee: 70,
    });
    assert.match(email.html, /Update Payment Method/);
    assert.match(email.html, /\/account\/payment/);
    assert.match(email.html, /Contact K9 ATELIER/);
    assert.match(email.html, /Book Another Appointment/);
    assert.doesNotMatch(email.html, />Book Another Appointment<\/a><\/td>/);
  });

  it("falls back to Contact K9 ATELIER when no payment-update page exists", () => {
    assert.equal(cancelPaymentUpdateUrl(null), null);
    const email = buildCancelFeeFailedEmail({
      appointment: appointment(),
      customer: alex,
      fee: 70,
      paymentUpdateUrl: null,
    });
    assert.match(email.html, />Contact K9 ATELIER<\/a>/);
    assert.doesNotMatch(email.html, /Update Payment Method/);
    assert.match(email.html, /\/contact/);
    assert.match(email.html, /Book Another Appointment/);
  });
});

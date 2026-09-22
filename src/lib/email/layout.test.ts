import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppointmentRecord } from "../appointments/types";
import { buildChargeReceiptCardHtml } from "../charges/receipt-email";
import type { AdminAppointmentRecord } from "../appointments/types";
import type { AppointmentChargeRecord } from "../charges/types";
import { buildCustomerCancelConfirmationEmail } from "./cancel-confirmation";
import { buildCancelFeeFailedEmail } from "./cancel-fee-failed";
import {
  buildCustomerAppointmentConfirmedEmail,
  buildCustomerAppointmentSubmittedEmail,
  buildVaccinationRejectedEmail,
  buildVaccinationVerifiedEmail,
} from "./html-templates";
import {
  buildCustomerFollowUpEmailHtml,
  buildCustomerLetterEmailHtml,
  emailLogoImg,
  getEmailBrand,
} from "./layout";
import { buildCustomerRemoveDogConfirmationEmail } from "./remove-dog-confirmation";

function appointment(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: "apt-1",
    customerId: "cust-1",
    petId: "pet-1",
    petName: "Maple",
    petBreed: "Cavapoo",
    serviceId: "signature-bath-style",
    serviceName: "Signature Bath & Style",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "123 Example Avenue",
    addressCity: "Palm Beach Gardens",
    addressState: "FL",
    addressZip: "33418",
    travelDistanceMiles: 8,
    travelFee: 0,
    appointmentDate: "2026-08-24",
    appointmentTime: "10:00 AM",
    scheduledStart: null,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: 140,
    newClientDeposit: null,
    vaccinationStatusAtBooking: null,
    status: "confirmed",
    confirmedAt: "2026-08-20T14:00:00.000Z",
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

function assertCustomerEmailLogo(html: string) {
  assert.match(html, /https:\/\/k9atelier\.com\/email-logo\.png/);
  assert.doesNotMatch(html, /https:\/\/k9atelier\.com\/logo\.png/);
  assert.doesNotMatch(html, /border-radius:50%/);
}

describe("customer email logo", () => {
  it("points getEmailBrand at the framed email mark", () => {
    assert.equal(getEmailBrand().logoUrl, "https://k9atelier.com/email-logo.png");
    assert.match(
      emailLogoImg(),
      /src="https:\/\/k9atelier\.com\/email-logo\.png"/,
    );
  });

  it("uses the framed logo in every customer-facing template", () => {
    const letter = buildCustomerLetterEmailHtml({
      subject: "Please confirm your K9 Atelier appointment",
      greetingName: "Alex",
      introParagraph: "K9 Atelier reserved this grooming visit for you.",
      detailRows: [{ label: "Date", value: "Monday, August 24, 2026" }],
      estimateNote: "An estimate, subject to coat condition.",
      closingParagraph: "You are not charged when you confirm.",
      cta: { href: "https://k9atelier.com/account/bookings", label: "CONFIRM APPOINTMENT" },
    });
    const receipt = buildChargeReceiptCardHtml(
      {
        petName: "Maple",
        appointmentDate: "2026-08-24",
        appointmentTime: "10:00",
        timezone: "America/New_York",
      } as AdminAppointmentRecord,
      {
        kind: "service",
        lineItems: [
          { id: "1", label: "Signature Bath & Style", amount: 140 },
        ],
        tipAmount: 0,
        total: 140,
        refundedAmount: 0,
        paidAt: "2026-08-24T18:00:00.000Z",
      } as AppointmentChargeRecord,
    );

    const templates = [
      letter,
      receipt,
      buildCustomerAppointmentSubmittedEmail(appointment(), alex).html,
      buildCustomerAppointmentConfirmedEmail(appointment(), alex).html,
      buildVaccinationVerifiedEmail({
        petName: "Maple",
        customerEmail: alex.email,
        customerName: alex.name,
        expirationDate: "2027-03-15",
      }).html,
      buildVaccinationRejectedEmail({
        petName: "Maple",
        customerEmail: alex.email,
        customerName: alex.name,
      }).html,
      buildCustomerCancelConfirmationEmail({
        appointment: appointment({ status: "cancelled" }),
        customer: alex,
        fee: 0,
      }).html,
      buildCancelFeeFailedEmail({
        appointment: appointment({ status: "cancelled" }),
        customer: alex,
        fee: 70,
      }).html,
      buildCustomerRemoveDogConfirmationEmail({
        appointment: appointment({ petName: "Maple" }),
        customer: alex,
        remainingAppointments: [appointment({ id: "apt-2", petName: "Otto" })],
        fee: 0,
      }).html,
      buildCustomerFollowUpEmailHtml({
        subject: "Checking in after Maple's groom",
        greetingName: "Alex",
        introParagraphs: [
          "I just wanted to check in and see how Maple is doing after yesterday's grooming appointment.",
        ],
        cta: {
          href: "https://g.page/r/CecMHxoqcJn8EBM/review",
          label: "Leave a Google Review",
        },
        closingParagraph: "Thank you again for trusting me with Maple.",
        signoffName: "Penny",
        signoffLines: ["K9 Atelier", "Private Mobile Pet Spa", "Palm Beach"],
      }),
    ];

    for (const html of templates) {
      assertCustomerEmailLogo(html);
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppointmentRecord } from "../appointments/types";
import {
  buildCancelFeeCopy,
  buildCustomerCancelConfirmationEmail,
  buildCustomerCancelEmailContent,
  formatPetNameList,
  resolveCancelFeeStatus,
} from "./cancel-confirmation";

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

describe("cancel confirmation copy", () => {
  it("formats one, two, and three pet names", () => {
    assert.equal(formatPetNameList(["Maple"]), "Maple");
    assert.equal(formatPetNameList(["Maple", "Otto"]), "Maple and Otto");
    assert.equal(
      formatPetNameList(["Maple", "Otto", "Daisy"]),
      "Maple, Otto, and Daisy",
    );
  });

  it("uses a pet-name subject for one dog and the studio subject for several", () => {
    const single = buildCustomerCancelEmailContent({
      appointment: appointment(),
      customer: alex,
      fee: 0,
    });
    const multiple = buildCustomerCancelEmailContent({
      appointment: appointment(),
      customer: alex,
      petNames: ["Maple", "Otto"],
      fee: 0,
    });
    assert.equal(single.subject, "Maple’s Appointment Has Been Canceled");
    assert.equal(
      multiple.subject,
      "Your K9 ATELIER Appointment Has Been Canceled",
    );
  });

  it("greets with the first name and binds date, time, and pet names", () => {
    const content = buildCustomerCancelEmailContent({
      appointment: appointment(),
      customer: alex,
      petNames: ["Maple", "Otto"],
      fee: 182.5,
      feeStatus: "paid",
    });
    assert.match(content.text, /^Dear Alex,/);
    assert.match(content.text, /Your appointment for Maple and Otto has been canceled/);
    assert.match(content.text, /Monday, August 24, 2026/);
    assert.match(content.text, /10:00 AM–12:00 PM/);
    assert.match(content.text, /\$182\.50/);
  });

  it("hides the time row when the appointment has no time", () => {
    const appointmentWithoutTime = appointment({ appointmentTime: "   " });
    const content = buildCustomerCancelEmailContent({
      appointment: appointmentWithoutTime,
      customer: alex,
      fee: 0,
    });
    const html = buildCustomerCancelConfirmationEmail({
      appointment: appointmentWithoutTime,
      customer: alex,
      fee: 0,
    }).html;
    assert.equal(content.timeLabel, null);
    assert.doesNotMatch(content.text, /10:00/);
    assert.match(content.text, /Monday, August 24, 2026/);
    assert.doesNotMatch(html, /10:00/);
  });

  it("shows no-fee copy and never $0.00", () => {
    assert.equal(resolveCancelFeeStatus(0), "none");
    assert.equal(resolveCancelFeeStatus(undefined, "paid"), "none");
    const copy = buildCancelFeeCopy({ fee: 0, feeStatus: "paid" });
    assert.deepEqual(copy.paragraphs, ["No cancellation fee was applied."]);
    assert.equal(copy.amountLabel, null);
    const email = buildCustomerCancelConfirmationEmail({
      appointment: appointment(),
      customer: alex,
      fee: 0,
    });
    assert.doesNotMatch(email.html, /\$0\.00/);
    assert.doesNotMatch(email.html, /CANCELLATION FEE/);
    assert.match(email.html, /No cancellation fee was applied/);
  });

  it("uses charged copy once when the fee is paid", () => {
    const copy = buildCancelFeeCopy({
      fee: 182.5,
      feeStatus: "paid",
      cardBrand: "visa",
      cardLast4: "4242",
    });
    assert.equal(copy.paragraphs.length, 2);
    assert.match(copy.paragraphs[0] ?? "", /cancellation fee of \$182\.50 has been charged/);
    assert.equal(
      copy.paragraphs[1],
      "The cancellation fee was charged to Visa ending in 4242.",
    );
    const html = buildCustomerCancelConfirmationEmail({
      appointment: appointment(),
      customer: alex,
      fee: 182.5,
      feeStatus: "paid",
      cardBrand: "visa",
      cardLast4: "4242",
    }).html;
    assert.equal((html.match(/\$182\.50/g) ?? []).length, 1);
    assert.doesNotMatch(html, /CANCELLATION FEE/);
  });

  it("does not invent a card line when brand or last four is missing", () => {
    const copy = buildCancelFeeCopy({
      fee: 70,
      feeStatus: "paid",
      cardBrand: "visa",
    });
    assert.equal(copy.paragraphs.length, 1);
    assert.doesNotMatch(copy.paragraphs[0] ?? "", /ending in/);
  });

  it("uses processing copy instead of has been charged", () => {
    const copy = buildCancelFeeCopy({ fee: 70, feeStatus: "processing" });
    assert.match(copy.paragraphs[0] ?? "", /is currently being processed/);
    assert.doesNotMatch(copy.paragraphs[0] ?? "", /has been charged/);
  });

  it("does not claim a failed fee was charged", () => {
    const copy = buildCancelFeeCopy({ fee: 70, feeStatus: "failed" });
    assert.match(copy.paragraphs[0] ?? "", /could not be charged/);
    assert.doesNotMatch(copy.paragraphs[0] ?? "", /has been charged/);
  });

  it("keeps a long name readable and uses the book and contact links", () => {
    const email = buildCustomerCancelConfirmationEmail({
      appointment: appointment({
        petName: "Bartholomew Maximilian-Whitfield",
      }),
      customer: {
        email: "guest@example.com",
        name: "Anastasia Montgomery-Whitfield",
        firstName: "Anastasia Montgomery-Whitfield",
      },
      fee: 0,
    });
    assert.match(email.html, /Dear Anastasia Montgomery-Whitfield,/);
    assert.match(email.html, /Bartholomew Maximilian-Whitfield/);
    assert.match(email.html, /word-break:break-word/);
    assert.match(email.html, /Book Another Appointment/);
    assert.match(email.html, /k9atelier.com\/book/);
    assert.match(email.html, /Contact K9 ATELIER/);
    assert.match(email.html, /k9atelier.com\/contact/);
    assert.doesNotMatch(email.html, /penny@k9atelier.com/);
  });
});

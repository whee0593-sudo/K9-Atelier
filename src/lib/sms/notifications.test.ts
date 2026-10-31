import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAppointmentConfirmRequestSms,
  buildAppointmentEnRouteSms,
  buildAppointmentReminderSms,
  buildAppointmentSubmittedSms,
  buildBookingConfirmationEmail,
  buildBookingConfirmationSms,
  formatSmsTimeWindow,
} from "@/lib/notifications";
import { streetNameForSms } from "@/lib/sms/street-name";

const details = {
  customerName: "Jane",
  petName: "Bella",
  serviceName: "Signature Bath & Care",
  dateLabel: "Tuesday, August 18, 2026",
  timeLabel: "10–11 AM",
  priceLabel: "$95",
};

describe("appointment SMS copy", () => {
  it("sends the approved booking success text without the state or ZIP", () => {
    const body = buildBookingConfirmationSms({
      ...details,
      isNewClient: true,
      streetName: "123 Palm Avenue",
      addressLabel: "123 Palm Avenue, West Palm Beach, FL 33401",
    });
    assert.equal(
      body,
      "K9 Atelier: You have an appointment for Bella on Tuesday, August 18, 2026, 10–11 AM, at 123 Palm Avenue, West Palm Beach. See you then!💜 Reply to talk to Penny about anything. Reply STOP to opt out.",
    );
    assert.equal(body.includes("Reply C"), false);
    assert.equal(body.includes("West Palm Beach"), true);
    assert.equal(body.includes("33401"), false);
    assert.equal(body.includes(", FL"), false);
  });

  it("keeps confirmed SMS concise for returning clients", () => {
    const body = buildBookingConfirmationSms({
      ...details,
      isNewClient: false,
      streetName: "88 Oak Street Apt 4",
    });
    assert.match(body, /K9 Atelier: You have an appointment for Bella on/);
    assert.match(body, /Oak Street/);
    assert.equal(body.includes("Apt 4"), true);
    assert.equal(body.includes("deposit"), false);
  });

  it("uses the concise confirmation email copy", () => {
    const email = buildBookingConfirmationEmail({
      ...details,
      addressLabel: "123 Palm Avenue, West Palm Beach, FL 33401",
      durationLabel: "2 hours",
    });
    assert.equal(email.subject, "Your Appointment Is Confirmed");
    assert.match(email.body, /Dear Jane, we look forward to caring for Bella/);
    assert.match(
      email.body,
      /Location: 123 Palm Avenue, West Palm Beach, FL 33401/,
    );
    assert.equal(email.body.includes("Reply C"), false);
  });

  it("keeps request, reminder, and on-the-way texts short", () => {
    const submitted = buildAppointmentSubmittedSms(details);
    const reminder = buildAppointmentReminderSms(details);
    const enRoute = buildAppointmentEnRouteSms(details);
    assert.match(submitted, /appointment request/);
    assert.match(submitted, /pending confirmation/);
    assert.match(reminder, /appointment is today/);
    assert.match(enRoute, /We're on the way/);
  });

  it("asks for C and keeps the location to the street name", () => {
    const body = buildAppointmentConfirmRequestSms({
      customerName: "Maya",
      petName: "Daisy",
      serviceName: "Signature Bath & Care",
      dateLabel: "Wednesday, July 8, 2026",
      timeLabel: "9:00–11:00 AM",
      streetName: "1234 SW 15th Street",
      addressLabel: "1234 SW 15th Street, West Palm Beach, FL 33401",
    });
    assert.equal(
      body,
      [
        "Daisy's appointment on Wednesday, July 8, 2026, 9am to 11am, SW 15th Street. Reply C to confirm.",
        "",
        "Reply STOP to opt out.",
      ].join("\n"),
    );
  });

  it("omits the place when the street name is missing", () => {
    const body = buildAppointmentConfirmRequestSms({
      petName: "Daisy",
      serviceName: "Signature Bath & Care",
      dateLabel: "Wednesday, July 8, 2026",
      timeLabel: "9:00–11:00 AM",
      streetName: "12",
    });
    assert.equal(
      body,
      [
        "Daisy's appointment on Wednesday, July 8, 2026, 9am to 11am. Reply C to confirm.",
        "",
        "Reply STOP to opt out.",
      ].join("\n"),
    );
  });

  it("formats arrival windows like 9am to 11am", () => {
    assert.equal(formatSmsTimeWindow("9:00–11:00 AM"), "9am to 11am");
    assert.equal(formatSmsTimeWindow("11:30 AM – 1:00 PM"), "11:30am to 1pm");
  });
});

describe("street name for confirmation SMS", () => {
  it("drops the house number and keeps the street", () => {
    assert.equal(streetNameForSms("123 Example Avenue"), "Example Avenue");
    assert.equal(streetNameForSms("100 Olive Ave"), "Olive Ave");
    assert.equal(streetNameForSms("123A Main St"), "Main St");
    assert.equal(streetNameForSms("12-14 Oak Ave"), "Oak Ave");
    assert.equal(streetNameForSms("1234 SW 15th Street"), "SW 15th Street");
    assert.equal(streetNameForSms("15th Street"), "15th Street");
    assert.equal(streetNameForSms("123 Main St Apt 4"), "Main St");
    assert.equal(streetNameForSms("123 Main St, Suite 200"), "Main St");
    assert.equal(streetNameForSms("123 Main St #4B"), "Main St");
    assert.equal(streetNameForSms("  88  N Palm Ave  "), "N Palm Ave");
    assert.equal(streetNameForSms("12"), "");
    assert.equal(streetNameForSms(""), "");
  });
});

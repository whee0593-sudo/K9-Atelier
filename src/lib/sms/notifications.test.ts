import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAppointmentConfirmRequestSms,
  buildAppointmentEnRouteSms,
  buildAppointmentReminderSms,
  buildAppointmentSubmittedSms,
  buildBookingConfirmationSms,
  formatSmsTimeWindow,
} from "@/lib/notifications";

const details = {
  customerName: "Jane",
  petName: "Bella",
  serviceName: "Signature Bath & Care",
  dateLabel: "Tuesday, August 18, 2026",
  timeLabel: "10–11 AM",
  priceLabel: "$95",
};

describe("appointment SMS copy", () => {
  it("uses welcome wording for first-visit clients", () => {
    const body = buildBookingConfirmationSms({ ...details, isNewClient: true });
    assert.match(body, /Welcome to K9 Atelier/);
    assert.match(body, /Payment is settled after your visit/);
    assert.equal(body.includes("deposit"), false);
    assert.match(body, /Reply STOP to opt out/);
  });

  it("omits deposit wording for returning clients", () => {
    const body = buildBookingConfirmationSms({ ...details, isNewClient: false });
    assert.match(body, /This confirms your K9 Atelier appointment/);
    assert.equal(body.includes("deposit"), false);
  });

  it("keeps request, reminder, and on-the-way texts short", () => {
    const submitted = buildAppointmentSubmittedSms(details);
    const reminder = buildAppointmentReminderSms(details);
    const enRoute = buildAppointmentEnRouteSms(details);
    assert.match(submitted, /We received your K9 Atelier request/);
    assert.match(reminder, /appointment is today/);
    assert.match(enRoute, /We're on the way/);
  });

  it("asks for YES and points to the appointments page", () => {
    const body = buildAppointmentConfirmRequestSms({
      customerName: "Maya",
      petName: "Daisy",
      serviceName: "Signature Bath & Care",
      dateLabel: "Wednesday, July 8, 2026",
      timeLabel: "9:00–11:00 AM",
    });
    assert.equal(
      body,
      [
        "K9 ATELIER: Hi Maya, please reply YES to confirm Daisy's Signature Bath & Care appointment on Wednesday, July 8, 2026 between 9am to 11am.",
        "",
        "To view, change, or cancel your appointment, visit:",
        "https://K9Atelier.com/account/appointments",
        "",
        "Changes and cancellations are subject to the policy accepted at booking.",
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

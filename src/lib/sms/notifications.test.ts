import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAppointmentEnRouteSms,
  buildAppointmentReminderSms,
  buildAppointmentSubmittedSms,
  buildBookingConfirmationSms,
} from "@/lib/notifications";

const details = {
  customerName: "Jane",
  petName: "Bella",
  serviceName: "Signature Bath & Care",
  dateLabel: "Tuesday, August 18, 2026",
  timeLabel: "10:00 AM – 10:30 AM",
  priceLabel: "$95",
};

describe("appointment SMS copy", () => {
  it("includes deposit wording for new clients", () => {
    const body = buildBookingConfirmationSms({ ...details, isNewClient: true });
    assert.match(body, /Welcome to K9 Atelier/);
    assert.match(body, /\$50 deposit/);
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
});

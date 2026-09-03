import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveStaffStatusNoticeKind } from "@/lib/appointments/staff-status-notice";
import type { AppointmentRecord } from "@/lib/appointments/types";
import { buildCustomerAppointmentStaffCancelledEmail } from "@/lib/email/html-templates";
import { buildAppointmentStaffCancelledSms } from "@/lib/notifications";

const appointment = {
  id: "11111111-1111-4111-8111-111111111111",
  customerId: "22222222-2222-4222-8222-222222222222",
  petId: "33333333-3333-4333-8333-333333333333",
  petName: "Bella",
  petBreed: "Poodle",
  serviceId: "signature-bath",
  serviceName: "Signature Bath & Care",
  addOnIds: [],
  addOnOptions: {},
  addressStreet: "1 Ocean Ave",
  addressCity: "Palm Beach",
  addressState: "FL",
  addressZip: "33480",
  travelDistanceMiles: 2,
  travelFee: 0,
  appointmentDate: "2026-08-18",
  appointmentTime: "10:00 AM",
  scheduledStart: null,
  timePreference: "morning",
  timezone: "America/New_York",
  estimatedTotal: 95,
  newClientDeposit: 0,
  vaccinationStatusAtBooking: "current",
  status: "cancelled",
  confirmedAt: "2026-08-01T12:00:00.000Z",
  customerConfirmedAt: null,
  createdAt: "2026-08-01T12:00:00.000Z",
} as AppointmentRecord;

describe("staff status notice routing", () => {
  it("sends confirmation when staff confirms a pending appointment", () => {
    assert.equal(
      resolveStaffStatusNoticeKind("confirmed", "pending_confirmation"),
      "confirmed",
    );
  });

  it("sends decline notice when staff declines a pending appointment", () => {
    assert.equal(
      resolveStaffStatusNoticeKind("cancelled", "pending_confirmation"),
      "declined",
    );
  });

  it("sends staff cancellation when a confirmed appointment is cancelled", () => {
    assert.equal(
      resolveStaffStatusNoticeKind("cancelled", "confirmed"),
      "staff_cancelled",
    );
  });
});

describe("staff cancelled customer notices", () => {
  it("builds a cancellation email that is not a decline notice", () => {
    const email = buildCustomerAppointmentStaffCancelledEmail(appointment, {
      email: "client@example.com",
      name: "Jane Client",
    });

    assert.equal(email.subject, "An Update Regarding Your Appointment");
    assert.match(email.text, /confirmed appointment for Bella/);
    assert.match(email.text, /has been cancelled/);
    assert.match(email.text, /book another available date/i);
    assert.equal(email.text.includes("unable to confirm"), false);
    assert.equal(email.text.toLowerCase().includes("declined"), false);
    assert.equal(email.text.toLowerCase().includes("vaccination review"), false);
  });

  it("builds a concise staff-cancellation SMS", () => {
    const body = buildAppointmentStaffCancelledSms({
      customerName: "Jane",
      petName: "Bella",
      serviceName: "Signature Bath & Care",
      dateLabel: "Tuesday, August 18, 2026",
      timeLabel: "10:00 AM",
    });

    assert.match(body, /^K9 Atelier:/);
    assert.match(
      body,
      /unable to accommodate your appointment on Tuesday, August 18, 2026 between 10:00 AM/,
    );
    assert.match(body, /book another available date/);
    assert.equal(body.toLowerCase().includes("declined"), false);
    assert.equal(body.toLowerCase().includes("vaccination"), false);
  });
});

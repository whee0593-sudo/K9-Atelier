import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppointmentReviewPanel } from "@/components/admin/AppointmentReviewPanel";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";

function pendingAppointment(): AdminAppointmentRecord {
  return {
    id: "milo-pending",
    customerId: "customer-tia",
    petId: "pet-milo",
    petName: "Milo",
    petBreed: "Papitese",
    serviceId: "atelier-full-groom",
    serviceName: "The Atelier Full Groom",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "1408 N Killian Drive",
    addressCity: "Lake Park",
    addressState: "FL",
    addressZip: "33404",
    travelDistanceMiles: 4.8,
    travelFee: 0,
    appointmentDate: "2026-09-16",
    appointmentTime: "3:00–4:23 PM",
    scheduledStart: null,
    timePreference: "afternoon",
    timezone: "America/New_York",
    estimatedTotal: 140,
    newClientDeposit: null,
    vaccinationStatusAtBooking: "needs_review",
    status: "pending_confirmation",
    confirmedAt: null,
    customerConfirmedAt: null,
    createdAt: "2026-09-01T14:00:00.000Z",
    customerEmail: "tiafrancavilla@gmail.com",
    customerName: "Tia Francavilla",
    customerFirstName: "Tia",
    customerLastName: "Francavilla",
    customerPhone: "+15613466778",
    reminderSmsSentAt: null,
    enRouteSmsSentAt: null,
    serviceStartedAt: null,
    serviceEndedAt: null,
  };
}

describe("appointment review cards", () => {
  it("does not ask staff to review vaccinations on the calendar queue", () => {
    const html = renderToStaticMarkup(
      <AppointmentReviewPanel previewAppointments={[pendingAppointment()]} />,
    );

    assert.match(html, /Milo/);
    assert.match(html, /The Atelier Full Groom/);
    assert.match(html, /Pending Review/);
    assert.match(html, /Approve booking/);
    assert.match(html, /Decline/);
    assert.equal(html.includes("Vaccination"), false);
    assert.equal(html.includes("Pending staff review at time of booking"), false);
    assert.equal(html.includes("Review vaccinations"), false);
    assert.equal(html.includes("Vaccination not approved"), false);
  });
});

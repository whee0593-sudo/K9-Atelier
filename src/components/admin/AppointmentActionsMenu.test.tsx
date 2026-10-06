import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminCancelAppointmentButton } from "@/components/admin/AdminCancelAppointmentButton";
import {
  AppointmentActionsMenu,
  customerTextHref,
} from "@/components/admin/AppointmentActionsMenu";
import { staffRescheduleSlotChoices } from "@/components/admin/AdminRescheduleAppointmentButton";
import { listStaffClockHourStarts } from "@/lib/appointments/staff-clock-window";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";

const appointment: AdminAppointmentRecord = {
  id: "appt-bella",
  customerId: "customer-maya",
  petId: "pet-bella",
  petName: "Bella",
  petBreed: "Goldendoodle",
  petWeightLbs: 42,
  serviceId: "full-groom",
  serviceName: "Full Groom",
  addOnIds: [],
  addOnOptions: {},
  addressStreet: "123 Example Avenue",
  addressCity: "Palm Beach Gardens",
  addressState: "FL",
  addressZip: "33418",
  travelDistanceMiles: 12,
  travelFee: 13,
  appointmentDate: "2026-10-12",
  appointmentTime: "9:00–10:30 AM",
  scheduledStart: 9 * 60,
  timePreference: "morning",
  timezone: "America/New_York",
  estimatedTotal: 180,
  newClientDeposit: null,
  vaccinationStatusAtBooking: "current",
  status: "confirmed",
  confirmedAt: null,
  customerConfirmedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  customerEmail: "maya@example.com",
  customerName: "Maya Patel",
  customerFirstName: "Maya",
  customerLastName: "Patel",
  customerPhone: "+15615550131",
  reminderSmsSentAt: null,
  enRouteSmsSentAt: null,
  serviceStartedAt: null,
  serviceEndedAt: null,
};

describe("appointment actions menu", () => {
  it("opens actions for an existing appointment", () => {
    const html = renderToStaticMarkup(
      <AppointmentActionsMenu
        appointment={appointment}
        variant="popover"
        top={12}
        left={12}
        onClose={() => {}}
      />,
    );
    assert.match(html, /Appointment Actions/);
    assert.match(html, /Maya Patel/);
    assert.match(html, /Bella/);
    assert.match(html, /Full Groom/);
    assert.match(html, /October 12, 2026/);
    assert.match(html, /9:00–10:30 AM/);
    assert.match(html, /Confirmed/);
    assert.match(html, /View Details/);
    assert.match(html, /Reschedule/);
    assert.match(html, /Contact Customer/);
    assert.match(html, /Cancel Appointment/);
    assert.match(html, /Collect payment/);
    assert.match(html, /min-h-11/);
    assert.doesNotMatch(html, /overflow-x|overflow-hidden/);
  });

  it("uses a bottom sheet on a narrow viewport", () => {
    const html = renderToStaticMarkup(
      <AppointmentActionsMenu
        appointment={appointment}
        variant="sheet"
        top={0}
        left={0}
        onClose={() => {}}
      />,
    );
    assert.match(html, /data-variant="sheet"/);
    assert.match(html, /items-end/);
    assert.match(html, /max-w-full/);
  });

  it("shows the appointment fields already stored on the record", () => {
    const html = renderToStaticMarkup(
      <AppointmentActionsMenu
        appointment={appointment}
        variant="popover"
        top={0}
        left={0}
        panel="details"
        onClose={() => {}}
      />,
    );
    assert.match(html, /Appointment details/);
    assert.match(html, /Maya Patel/);
    assert.match(html, /\+15615550131/);
    assert.match(html, /maya@example.com/);
    assert.match(html, /Goldendoodle/);
    assert.match(html, /42 lb/);
    assert.match(html, /Full Groom/);
    assert.match(html, /October 12, 2026/);
    assert.match(html, /9:00–10:30 AM/);
    assert.match(html, /123 Example Avenue, Palm Beach Gardens, FL 33418/);
    assert.match(html, /\$13/);
    assert.match(html, /Vaccines on file/);
    assert.match(html, /Confirmed/);
  });

  it("reuses the text and email contact paths", () => {
    assert.equal(
      customerTextHref({
        customerId: "customer-maya",
        phone: "+15615550131",
      }),
      "/admin/messages?customer=customer-maya&phone=%2B15615550131",
    );
    const html = renderToStaticMarkup(
      <AppointmentActionsMenu
        appointment={appointment}
        variant="sheet"
        top={0}
        left={0}
        panel="contact"
        onClose={() => {}}
      />,
    );
    assert.match(html, />Call</);
    assert.match(html, /href="\/admin\/messages\?customer=customer-maya&amp;phone=%2B15615550131"/);
    assert.match(html, /href="mailto:maya@example.com"/);
    assert.match(html, />Text</);
    assert.match(html, />Email</);
  });

  it("asks before cancelling and keeps the existing status workflow copy", () => {
    const html = renderToStaticMarkup(
      <AdminCancelAppointmentButton
        appointment={appointment}
        confirmTitle="Cancel Appointment?"
        showService
        showReason
        defaultOpen
        onCancelled={() => {}}
      />,
    );
    assert.match(html, /Cancel Appointment\?/);
    assert.match(html, /Maya Patel/);
    assert.match(html, /Bella/);
    assert.match(html, /October 12, 2026/);
    assert.match(html, /Full Groom/);
    assert.match(html, /Cancellation reason/);
    assert.match(html, /Keep Appointment/);
    assert.match(html, />Cancel Appointment</);
  });
});

describe("calendar reschedule slot list", () => {
  it("keeps a blocked day empty and falls back to every clock hour", () => {
    assert.deepEqual(staffRescheduleSlotChoices([9 * 60, 15 * 60], true, true), [
      9 * 60,
      15 * 60,
    ]);
    assert.deepEqual(staffRescheduleSlotChoices([], true, true), []);
    assert.deepEqual(
      staffRescheduleSlotChoices(undefined, true, true),
      listStaffClockHourStarts(),
    );
    assert.deepEqual(staffRescheduleSlotChoices(undefined, false, true), []);
    const hours = listStaffClockHourStarts();
    assert.equal(hours[0], 0);
    assert.equal(hours.at(-1), 23 * 60);
  });
});

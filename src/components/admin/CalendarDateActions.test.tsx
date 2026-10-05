import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminCalendarMonthGrid } from "@/components/admin/AdminCalendarMonthGrid";
import {
  BlockAllDayDialog,
  BlockTimeDialog,
  CalendarDateActionMenu,
  ManageAvailabilityDialog,
  ViewDayDialog,
} from "@/components/admin/CalendarDateActions";
import type { AvailabilityBlock } from "@/lib/appointments/availability-blocks";
import type { AdminCalendarDay } from "@/lib/appointments/calendar";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";

function sampleAppointment(
  patch: Partial<AdminAppointmentRecord> &
    Pick<AdminAppointmentRecord, "id" | "petName" | "serviceName" | "appointmentTime">,
): AdminAppointmentRecord {
  return {
    customerId: "c",
    petId: "p",
    petBreed: "",
    serviceId: "full-groom",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "123 Example Avenue",
    addressCity: "Palm Beach Gardens",
    addressState: "FL",
    addressZip: "33418",
    travelDistanceMiles: 0,
    travelFee: 0,
    appointmentDate: "2026-10-20",
    scheduledStart: null,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: null,
    newClientDeposit: null,
    vaccinationStatusAtBooking: null,
    status: "confirmed",
    confirmedAt: null,
    customerConfirmedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    customerEmail: "a@example.com",
    customerName: "Alex",
    customerFirstName: "Alex",
    customerLastName: null,
    customerPhone: "+15615550100",
    reminderSmsSentAt: null,
    enRouteSmsSentAt: null,
    serviceStartedAt: null,
    serviceEndedAt: null,
    ...patch,
  };
}

function calendarDay(
  patch: Partial<AdminCalendarDay> &
    Pick<AdminCalendarDay, "date" | "appointmentCount" | "availabilityLabel">,
): AdminCalendarDay {
  return {
    isPast: false,
    isFull: false,
    isToday: false,
    closure: null,
    closureLabel: null,
    blocks: [],
    ...patch,
  };
}

const partial: AvailabilityBlock = {
  id: "11111111-1111-4111-8111-111111111111",
  serviceDate: "2026-10-12",
  allDay: false,
  startMinutes: 10 * 60,
  endMinutes: 14 * 60,
  reason: "Personal",
};

describe("Calendar date actions", () => {
  it("lists the date menu without manage until a block exists", () => {
    const html = renderToStaticMarkup(
      <CalendarDateActionMenu
        date="2026-10-05"
        variant="popover"
        top={20}
        left={20}
        hasBlocks={false}
        onClose={() => {}}
        onAction={() => {}}
      />,
    );
    assert.match(html, /Monday, October 5/);
    assert.match(html, /Book for Customer/);
    assert.match(html, /Block Time/);
    assert.match(html, /Block All Day/);
    assert.match(html, /View Day/);
    assert.doesNotMatch(html, /Manage Availability/);
    assert.match(html, /min-h-11/);
  });

  it("uses a bottom sheet on a narrow viewport and offers manage", () => {
    const html = renderToStaticMarkup(
      <CalendarDateActionMenu
        date="2026-10-12"
        variant="sheet"
        top={0}
        left={0}
        hasBlocks
        onClose={() => {}}
        onAction={() => {}}
      />,
    );
    assert.match(html, /data-variant="sheet"/);
    assert.match(html, /Monday, October 12/);
    assert.match(html, /Manage Availability/);
    assert.match(html, /items-end/);
  });

  it("fills the clicked date into block time and all-day confirms", () => {
    const time = renderToStaticMarkup(
      <BlockTimeDialog
        date="2026-10-12"
        block={null}
        busy={false}
        error={null}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    assert.match(time, /Block Time/);
    assert.match(time, /October 12/);
    assert.match(time, /10:00 AM/);
    assert.match(time, /2:00 PM/);
    assert.match(time, /Personal, appointment, maintenance, etc./);

    const day = renderToStaticMarkup(
      <BlockAllDayDialog
        date="2026-10-12"
        block={null}
        busy={false}
        error={null}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    assert.match(day, /Block Entire Day\?/);
    assert.match(day, /Customers will not be able to book appointments on this date/);
    assert.match(day, /Monday, October 12, 2026/);
    assert.match(day, /Personal, holiday, training, maintenance, etc./);
    assert.match(day, />Block All Day</);
    assert.match(day, /data-block-all-day="confirm"/);
  });

  it("warns before blocking a day that already has appointments", () => {
    const html = renderToStaticMarkup(
      <BlockAllDayDialog
        date="2026-10-20"
        block={null}
        busy={false}
        error={null}
        appointments={[
          sampleAppointment({
            id: "milo",
            petName: "Milo",
            customerName: "Jordan Lee",
            serviceName: "Bath & Coat Care",
            appointmentTime: "1:30–3:00 PM",
            scheduledStart: 13 * 60 + 30,
            customerPhone: "+15615550199",
          }),
          sampleAppointment({
            id: "cancelled-ghost",
            petName: "Ghost",
            customerName: "Pat Cancelled",
            serviceName: "Full Groom",
            appointmentTime: "11:00 AM",
            scheduledStart: 11 * 60,
            status: "cancelled",
          }),
          sampleAppointment({
            id: "bella",
            petName: "Bella",
            customerName: "Alex Rivera",
            serviceName: "Full Groom",
            appointmentTime: "9:00–10:30 AM",
            scheduledStart: 9 * 60,
          }),
        ]}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    assert.match(html, /Appointments Already Scheduled/);
    assert.match(
      html,
      /Blocking the day will prevent new bookings, but existing appointments will remain scheduled/,
    );
    assert.match(html, /October 20, 2026/);
    assert.match(html, /Existing appointments:/);
    assert.match(html, /9:00–10:30 AM/);
    assert.match(html, /Alex Rivera/);
    assert.match(html, /Bella/);
    assert.match(html, /Full Groom/);
    assert.match(html, /1:30–3:00 PM/);
    assert.match(html, /Jordan Lee/);
    assert.match(html, /Milo/);
    assert.match(html, /Bath &amp; Coat Care/);
    assert.match(html, /data-existing-appointment="bella"/);
    assert.match(html, /data-existing-appointment="milo"/);
    assert.doesNotMatch(html, /Ghost/);
    assert.doesNotMatch(html, /Pat Cancelled/);
    assert.doesNotMatch(html, /\+15615550199/);
    assert.doesNotMatch(html, /123 Example Avenue/);
    assert.match(html, />Cancel</);
    assert.match(html, />Block All Day Anyway</);
    assert.doesNotMatch(html, /Block Entire Day\?/);
    assert.ok(html.indexOf("Bella") < html.indexOf("Milo"));
  });

  it("keeps the ordinary confirm while appointments are still loading or absent", () => {
    const loading = renderToStaticMarkup(
      <BlockAllDayDialog
        date="2026-10-20"
        block={null}
        busy={false}
        error={null}
        appointments={null}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    assert.match(loading, /Checking this day…/);
    assert.doesNotMatch(loading, /Block All Day Anyway/);
    assert.doesNotMatch(loading, />Block All Day</);

    const editing = renderToStaticMarkup(
      <BlockAllDayDialog
        date="2026-10-20"
        block={{
          id: "day",
          serviceDate: "2026-10-20",
          allDay: true,
          startMinutes: null,
          endMinutes: null,
          reason: "Holiday",
        }}
        busy={false}
        error={null}
        appointments={[
          sampleAppointment({
            id: "bella",
            petName: "Bella",
            serviceName: "Full Groom",
            appointmentTime: "9:00–10:30 AM",
          }),
        ]}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    assert.match(editing, /Block Entire Day\?/);
    assert.match(editing, />Save</);
    assert.doesNotMatch(editing, /Appointments Already Scheduled/);
  });

  it("shows Unavailable and the booked count together, and keeps appointments in view day", () => {
    const html = renderToStaticMarkup(
      <AdminCalendarMonthGrid
        month="2026-10"
        days={[
          calendarDay({
            date: "2026-10-20",
            appointmentCount: 2,
            availabilityLabel: "Unavailable",
            blocks: [
              {
                id: "day",
                serviceDate: "2026-10-20",
                allDay: true,
                startMinutes: null,
                endMinutes: null,
                reason: null,
              },
            ],
          }),
          calendarDay({
            date: "2026-10-21",
            appointmentCount: 0,
            availabilityLabel: "Unavailable",
          }),
        ]}
        selectedDate={null}
        onPrevMonth={() => {}}
        onNextMonth={() => {}}
        onSelectDate={() => {}}
      />,
    );
    assert.match(html, /Unavailable/);
    assert.match(html, /2 booked/);
    assert.equal(html.match(/Unavailable/g)?.length, 2);
    assert.equal(html.match(/booked/g)?.length, 1);
    assert.doesNotMatch(html, /overflow-hidden/);

    const day = renderToStaticMarkup(
      <ViewDayDialog
        date="2026-10-20"
        loading={false}
        appointments={[
          sampleAppointment({
            id: "bella",
            petName: "Bella",
            serviceName: "Full Groom",
            appointmentTime: "9:00–10:30 AM",
            scheduledStart: 9 * 60,
          }),
          sampleAppointment({
            id: "milo",
            petName: "Milo",
            serviceName: "Bath & Coat Care",
            appointmentTime: "1:30–3:00 PM",
            scheduledStart: 13 * 60 + 30,
          }),
        ]}
        blocks={[
          {
            id: "day",
            serviceDate: "2026-10-20",
            allDay: true,
            startMinutes: null,
            endMinutes: null,
            reason: null,
          },
        ]}
        onClose={() => {}}
      />,
    );
    assert.match(day, /October 20/);
    assert.match(day, /Unavailable — All Day/);
    assert.match(day, /9:00 AM/);
    assert.match(day, /Bella/);
    assert.match(day, /Full Groom/);
    assert.match(day, /Confirmed/);
    assert.match(day, /1:30 PM/);
    assert.match(day, /Milo/);
    assert.match(day, /Bath &amp; Coat Care/);
    assert.match(day, /data-day-entry="appointment"/);
    assert.match(day, /data-day-entry="block"/);
    assert.doesNotMatch(day, />Blocked</);
  });

  it("lists a block for edit or removal and a read-only day timeline", () => {
    const manage = renderToStaticMarkup(
      <ManageAvailabilityDialog
        blocks={[partial]}
        busyId={null}
        error={null}
        onClose={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
      />,
    );
    assert.match(manage, /10:00 AM – 2:00 PM/);
    assert.match(manage, /Personal/);
    assert.match(manage, />Edit</);
    assert.match(manage, />Remove</);

    const day = renderToStaticMarkup(
      <ViewDayDialog
        date="2026-10-12"
        loading={false}
        appointments={[
          {
            id: "bella",
            customerId: "c",
            petId: "p",
            petName: "Bella",
            petBreed: "",
            serviceId: "full-groom",
            serviceName: "Full Groom",
            addOnIds: [],
            addOnOptions: {},
            addressStreet: "",
            addressCity: "",
            addressState: "",
            addressZip: "",
            travelDistanceMiles: 0,
            travelFee: 0,
            appointmentDate: "2026-10-12",
            appointmentTime: "9:00–10:30 AM",
            scheduledStart: 9 * 60,
            timePreference: "morning",
            timezone: "America/New_York",
            estimatedTotal: null,
            newClientDeposit: null,
            vaccinationStatusAtBooking: null,
            status: "confirmed",
            confirmedAt: null,
            customerConfirmedAt: null,
            createdAt: "2026-10-01T00:00:00.000Z",
            customerEmail: "a@example.com",
            customerName: "Alex",
            customerFirstName: "Alex",
            customerLastName: null,
            customerPhone: null,
            reminderSmsSentAt: null,
            enRouteSmsSentAt: null,
            serviceStartedAt: null,
            serviceEndedAt: null,
          },
        ]}
        blocks={[partial]}
        onClose={() => {}}
      />,
    );
    assert.match(day, /October 12/);
    assert.match(day, /9:00 AM/);
    assert.match(day, /Bella/);
    assert.match(day, /Full Groom/);
    assert.match(day, /Confirmed/);
    assert.match(day, /data-day-entry="appointment"/);
    assert.match(day, /Blocked · Personal/);
    assert.match(day, /data-day-entry="block"/);
    assert.match(day, /min-h-11/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BlockAllDayDialog,
  BlockTimeDialog,
  CalendarDateActionMenu,
  ManageAvailabilityDialog,
  ViewDayDialog,
} from "@/components/admin/CalendarDateActions";
import type { AvailabilityBlock } from "@/lib/appointments/availability-blocks";

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

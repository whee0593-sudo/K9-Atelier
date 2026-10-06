import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppointmentReviewPanel } from "@/components/admin/AppointmentReviewPanel";
import { OnTheWayPreview } from "@/components/admin/OnTheWayPreview";
import { buildPreviewOnTheWayAppointments } from "@/lib/appointments/calendar-preview";

describe("appointment review page", () => {
  it("does not keep a vaccination review queue under the calendar", () => {
    const html = renderToStaticMarkup(<AppointmentReviewPanel preview />);

    assert.match(html, /Route days/);
    assert.match(html, /Today — drive order/);
    assert.match(html, /No appointments on today/);
    assert.equal(html.includes("No confirmed appointments"), false);
    assert.equal(html.includes("Approve booking"), false);
    assert.equal(html.includes("Decline"), false);
    assert.equal(html.includes("Review vaccinations"), false);
    assert.equal(html.includes("Pending staff review"), false);
    assert.equal(html.includes("waiting for staff review"), false);
    assert.equal(html.includes("All caught up"), false);
  });

  it("lists today's unconfirmed appointments with an on-the-way text button", () => {
    const pending = {
      ...buildPreviewOnTheWayAppointments()[0]!,
      id: "pending-today",
      petName: "Nori",
      status: "pending_confirmation" as const,
      confirmedAt: null,
      customerConfirmedAt: null,
      enRouteSmsSentAt: null,
    };
    const html = renderToStaticMarkup(
      <AppointmentReviewPanel preview previewToday={[pending]} />,
    );

    assert.match(html, /Nori/);
    assert.match(html, /Pending Review/);
    assert.match(html, /<button type="button"[^>]*>Text: on the way<\/button>/);
    assert.equal(html.includes("No mobile number"), false);
    assert.equal(html.includes("On-the-way text sent"), false);
  });
});

describe("on-the-way preview", () => {
  it("shows a pending stop with an enabled on-the-way button", () => {
    const html = renderToStaticMarkup(<OnTheWayPreview />);
    assert.match(html, /Nori/);
    assert.match(html, /Pending Review/);
    assert.match(html, /Text: on the way/);
  });
});

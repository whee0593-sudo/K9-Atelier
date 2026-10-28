import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AppointmentReviewPanel } from "@/components/admin/AppointmentReviewPanel";
import { OnTheWayPreview } from "@/components/admin/OnTheWayPreview";
import { buildPreviewOnTheWayAppointments } from "@/lib/appointments/calendar-preview";

Object.assign(globalThis, { React });

const testRouter: AppRouterInstance = {
  back() {},
  forward() {},
  prefetch() {},
  push() {},
  refresh() {},
  replace() {},
};

function renderReviewPanel(node: React.ReactElement) {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={testRouter}>{node}</AppRouterContext.Provider>,
  );
}

describe("appointment review page", () => {
  it("does not keep a vaccination review queue under the calendar", () => {
    const html = renderReviewPanel(<AppointmentReviewPanel preview />);

    assert.match(html, /Route days/);
    assert.match(html, /Today — drive order/);
    assert.match(html, /No appointments on today/);
    const driveOrder = html.indexOf("Today — drive order");
    const routeDays = html.indexOf("Route days");
    const dayList = html.indexOf("No appointments on this day.");
    assert.ok(driveOrder !== -1 && routeDays !== -1 && dayList !== -1);
    assert.ok(driveOrder < routeDays);
    assert.ok(routeDays < dayList);
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
    const html = renderReviewPanel(
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

it("shows one household stop and one set of actions for sibling dogs", () => {
  const first = {...buildPreviewOnTheWayAppointments()[0]!, id:"v", visitId:"household-visit", petName:"Valentino"};
  const second = {...first, id:"s", petName:"Stella", scheduledStart:(first.scheduledStart ?? 540)+90};
  const html = renderReviewPanel(<AppointmentReviewPanel preview previewToday={[first, second]} />);
  assert.match(html, /Valentino/); assert.match(html, /Stella/);
  assert.equal((html.match(/Text: on the way/g) ?? []).length, 1);
  assert.equal((html.match(/>Check in<\/a>/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Stop 2/);
});
it("keeps separate visits for the same household separate", () => {
  const first = {...buildPreviewOnTheWayAppointments()[0]!, id:"a", visitId:"morning"};
  const second = {...first, id:"b", visitId:"afternoon"};
  const html = renderReviewPanel(<AppointmentReviewPanel preview previewToday={[first, second]} />);
  assert.equal((html.match(/Text: on the way/g) ?? []).length, 2);
});


it("lays out a visit as owner, address, status, and one service row per dog", () => {
  const first = {...buildPreviewOnTheWayAppointments()[0]!, id:"dog-1", visitId:"three-dog-visit", customerName:"Taylor Owner", customerPhone:"561-555-0101", petName:"Valentino", serviceName:"Full Groom", status:"confirmed" as const};
  const pets = [first, {...first, id:"dog-2", petName:"Stella"}, {...first, id:"dog-3", petName:"Luna", serviceName:"Bath & Care"}];
  const html = renderReviewPanel(<AppointmentReviewPanel preview previewToday={pets} />);
  const drive = html.slice(html.indexOf("Today — drive order"), html.indexOf("Route days"));
  assert.match(drive, /<h3[^>]*>Taylor Owner<\/h3>/);
  assert.equal((drive.match(/Taylor Owner/g) ?? []).length, 1);
  for (const [name, service] of [["Valentino", "Full Groom"], ["Stella", "Full Groom"], ["Luna", "Bath &amp; Care"]]) {
    assert.ok(drive.includes(name + " — " + service + "</li>"));
  }
  assert.ok(drive.indexOf("561-555-0101") < drive.indexOf("Confirmed"));
  assert.ok(drive.indexOf("Confirmed") < drive.indexOf("Valentino"));
  assert.ok(drive.indexOf("Text: on the way") < drive.indexOf(">Check in</a>"));
  assert.ok(drive.indexOf(">Check in</a>") < drive.indexOf(">Collect payment</a>"));
  assert.match(drive, /flex basis-full flex-wrap gap-3/);
  assert.equal((drive.match(/>Collect payment<\/a>/g) ?? []).length, 1);
});

it("uses the owner heading for single-dog stops too", () => {
  const appointment = {...buildPreviewOnTheWayAppointments()[0]!, customerName:"Taylor Owner", petName:"Valentino"};
  const html = renderReviewPanel(<AppointmentReviewPanel preview previewToday={[appointment]} />);
  assert.match(html, /<h3[^>]*>Taylor Owner<\/h3>/);
  assert.match(html, /Valentino — /);
});

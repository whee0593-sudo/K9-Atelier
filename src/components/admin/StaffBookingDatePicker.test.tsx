import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaffBookingDatePicker } from "@/components/admin/StaffBookingDatePicker";

describe("StaffBookingDatePicker", () => {
  it("opens the admin occupancy calendar instead of a native date list", () => {
    const html = renderToStaticMarkup(
      <StaffBookingDatePicker
        value=""
        openDates={["2026-09-21", "2026-09-24"]}
        preview
        defaultOpen
        onChange={() => {}}
      />,
    );
    assert.match(html, /role="dialog"/);
    assert.match(html, /Choose a date/);
    assert.match(html, /Gray days are in the past or fully booked/);
    assert.match(html, /2 booked/);
    assert.match(html, /4 booked/);
    assert.match(html, /bg-white/);
    assert.match(html, /bg-lavender-light\/70/);
    assert.doesNotMatch(html, /type="date"/);
  });

  it("still shows a month grid when live occupancy cannot load", () => {
    const html = renderToStaticMarkup(
      <StaffBookingDatePicker
        value=""
        openDates={["2026-09-21"]}
        defaultOpen
        onChange={() => {}}
      />,
    );
    assert.match(html, /Choose a date/);
    assert.match(html, /September 2026/);
    assert.match(html, />21</);
  });
});

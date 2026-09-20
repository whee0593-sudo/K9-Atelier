import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingProgress } from "@/components/booking/BookingProgress";

describe("BookingProgress", () => {
  it("renders the six booking steps and marks the current one", () => {
    const html = renderToStaticMarkup(<BookingProgress currentStep={2} />);
    assert.match(html, /01 Your Dog/);
    assert.match(html, /02 Date &amp; Time/);
    assert.match(html, /03 Care/);
    assert.match(html, /04 Your Details/);
    assert.match(html, /05 Payment/);
    assert.match(html, /06 Confirm/);
  });

  it("uses a compact mobile progress label and indicator", () => {
    const html = renderToStaticMarkup(<BookingProgress currentStep={2} />);
    assert.match(html, /Step 2 of 6/);
    assert.match(html, />Date &amp; Time</);
    assert.match(html, /role="progressbar"/);
    assert.match(html, /aria-valuenow="2"/);
    assert.match(html, /sm:hidden/);
    assert.match(html, /hidden flex-wrap gap-x-4 gap-y-3 sm:flex/);
  });
});

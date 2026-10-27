import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingProgress } from "@/components/booking/BookingProgress";

describe("BookingProgress", () => {
  it("renders the six booking steps and marks the current one", () => {
    const html = renderToStaticMarkup(<BookingProgress currentStep={2} />);
    assert.match(html, /01 About Your Pup/);
    assert.match(html, /02 Service/);
    assert.match(html, /03 Date &amp; Time/);
    assert.match(html, /04 About You/);
    assert.match(html, /05 Secure Your Appointment/);
    assert.match(html, /06 Confirm/);
  });

  it("uses a compact mobile progress label and indicator", () => {
    const html = renderToStaticMarkup(<BookingProgress currentStep={2} />);
    assert.match(html, /Step 2 of 6/);
    assert.match(html, />Service</);
    assert.match(html, /role="progressbar"/);
    assert.match(html, /aria-valuenow="2"/);
    assert.match(html, /sm:hidden/);
    assert.match(html, /hidden flex-wrap gap-x-4 gap-y-3 sm:flex/);
  });
  it("shows five introductory labels while retaining the real card setup and confirm steps", () => {
    const intro = renderToStaticMarkup(<BookingProgress currentStep={1} />);
    assert.match(intro, /01 About Your Pup/);
    assert.match(intro, /04 About You/);
    assert.match(intro, /05 Confirm/);
    assert.doesNotMatch(intro, /Secure Your Appointment|06 Confirm/);
    const card = renderToStaticMarkup(<BookingProgress currentStep={5} />);
    assert.match(card, /Step 5 of 6/);
    assert.match(card, /Secure Your Appointment/);
    const confirm = renderToStaticMarkup(<BookingProgress currentStep={6} />);
    assert.match(confirm, /Step 6 of 6/);
  });

});

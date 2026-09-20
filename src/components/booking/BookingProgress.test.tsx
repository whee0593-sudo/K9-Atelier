import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingProgress } from "@/components/booking/BookingProgress";

describe("BookingProgress", () => {
  it("renders the seven booking steps and marks the current one", () => {
    const html = renderToStaticMarkup(<BookingProgress currentStep={3} />);
    assert.match(html, /01 Your Dog/);
    assert.match(html, /02 Date &amp; Time/);
    assert.match(html, /03 Add Details/);
    assert.match(html, /04 Care/);
    assert.match(html, /05 Your Details/);
    assert.match(html, /06 Payment/);
    assert.match(html, /07 Confirm/);
  });
});

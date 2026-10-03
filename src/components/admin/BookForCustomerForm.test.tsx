import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookForCustomerForm } from "@/components/admin/BookForCustomerForm";

describe("BookForCustomerForm preview schedule", () => {
  it("opens a calendar picker instead of a free date field that can land on a closed day", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm preview />);
    assert.match(html, /id="appointment-date"/);
    assert.match(html, /Select a date/);
    assert.match(html, /aria-haspopup="dialog"/);
    assert.doesNotMatch(html, /type="date"/);
    assert.doesNotMatch(html, /<select id="appointment-date"/);
    assert.match(html, /Select a date to see available start hours/);
  });

  it("keeps the date picker available before the service area is checked", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm />);
    assert.match(html, /id="appointment-date"/);
    assert.match(html, /Select a date/);
    assert.match(html, /Studio dates are listed/);
    assert.doesNotMatch(html, /Could not load available dates/);
  });

  it("shows dog fields with an Add control under the first row", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm preview />);
    assert.match(html, /Dog name/);
    assert.match(html, /Breed/);
    assert.match(html, /Weight \(lbs\)/);
    assert.match(html, />Add</);
  });

  it("explains that only email or phone is required", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm preview />);
    assert.match(html, /Only an email or mobile phone is required/);
    assert.match(html, /Send booking link/);
    assert.doesNotMatch(html, /\srequired(=|>|\s)/);
  });
});

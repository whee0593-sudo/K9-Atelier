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

  it("uses the calendar date as the default appointment date", () => {
    const html = renderToStaticMarkup(
      <BookForCustomerForm preview initialDate="2026-10-12" />,
    );
    assert.match(html, /Mon, Oct 12/);
    assert.match(html, /value="2026-10-12"/);
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

  it("fills saved pets and address from an existing customer file", () => {
    const html = renderToStaticMarkup(
      <BookForCustomerForm
        preview
        prefill={{
          customerId: "11111111-1111-4111-8111-111111111111",
          firstName: "Jose",
          lastName: "Perez",
          email: "jose@example.com",
          phone: "+15613520356",
        }}
        initialProfile={{
          customerId: "11111111-1111-4111-8111-111111111111",
          firstName: "Jose",
          lastName: "Perez",
          email: "jose@example.com",
          phone: "+15613520356",
          pets: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Luna",
              breed: "Poodle",
              weightLbs: 14.5,
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: "Max",
              breed: "Maltese",
              weightLbs: 11,
            },
          ],
          addresses: [
            {
              street: "10 Main St",
              city: "Palm Beach",
              state: "FL",
              zip: "33480",
            },
            {
              street: "20 Ocean Ave",
              city: "Palm Beach",
              state: "FL",
              zip: "33480",
            },
          ],
        }}
      />,
    );
    assert.match(html, /value="Luna"/);
    assert.match(html, /value="Poodle"/);
    assert.match(html, /value="14.5"/);
    assert.match(html, /value="Max"/);
    assert.match(html, /value="10 Main St"/);
    assert.match(html, /value="33480"/);
    assert.match(html, /Saved addresses/);
    assert.match(html, /20 Ocean Ave/);
    assert.match(html, /Saved pets and address are filled in from this customer/);
  });
});

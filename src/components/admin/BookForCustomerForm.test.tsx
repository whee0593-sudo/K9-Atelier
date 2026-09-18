import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookForCustomerForm } from "@/components/admin/BookForCustomerForm";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import { formatStaffDateOption } from "@/lib/staff/book-for-customer-schedule";

describe("BookForCustomerForm preview schedule", () => {
  it("lists bookable dates instead of a free calendar that can land on a closed day", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm preview />);
    const first = getUpcomingBookableDates(1)[0];
    assert.ok(first);
    assert.match(html, /id="appointment-date"/);
    assert.match(html, new RegExp(first.value));
    assert.match(html, new RegExp(formatStaffDateOption(first.value)));
    assert.doesNotMatch(html, /type="date"/);
    assert.match(html, /Select a date to see available start hours/);
  });

  it("lists studio dates before the service area is checked", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm />);
    const first = getUpcomingBookableDates(1)[0];
    assert.ok(first);
    assert.match(html, new RegExp(`value="${first.value}"`));
    assert.match(html, new RegExp(formatStaffDateOption(first.value)));
    assert.match(html, /Studio dates are listed/);
  });
});

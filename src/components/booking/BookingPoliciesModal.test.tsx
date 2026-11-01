import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingPoliciesModal, type BookingPolicySectionId } from "./BookingPoliciesModal";
import { CANCELLATION_POLICY_ROWS } from "@/lib/appointments/policy-copy";

(globalThis as { React?: typeof React }).React = React;
function render(section: BookingPolicySectionId, showPrices = false) {
  return renderToStaticMarkup(<BookingPoliciesModal open onClose={() => {}} initialSection={section} showPrices={showPrices} />);
}
describe("concise booking policy modal", () => {
  it("keeps cancellation rates, calendar timezone and no-show protections", () => {
    const html = render("cancellation");
    for (const [label, value] of CANCELLATION_POLICY_ROWS) {
      assert.ok(html.includes(label));
      assert.ok(html.includes(value));
    }
    assert.match(html, /America\/New_York/);
    assert.match(html, /<details>/);
    assert.match(html, /Fee details &amp; exceptions/);
    assert.match(html, /No-show and cancellation fees are not combined/);
    assert.match(html, /Removing one dog/);
    assert.match(html, /Unpriced add-ons are excluded/);
    assert.equal(html.includes("Because every K9 Atelier"), false);
  });
  it("references cancellation fees rather than repeating the table for rescheduling", () => {
    const html = render("rescheduling");
    assert.match(html, /original appointment date/);
    assert.match(html, /View cancellation fees/);
    assert.equal(html.includes("Two or more calendar days before"), false);
  });
  it("keeps no booking charge, payment preference and saved-card fee disclosure", () => {
    const html = render("payment");
    assert.match(html, /No charge at booking/);
    assert.match(html, /cash or Zelle/);
    assert.match(html, /fees may be charged to your saved card/);
    assert.equal(html.includes("After you choose"), false);
  });
  it("keeps the incomplete-service minimum, travel and operator-side exception", () => {
    const html = render("incomplete-service");
    assert.match(html, /minimum of 50%/);
    assert.match(html, /Travel fees still apply/);
    assert.match(html, /no charge or rescheduling penalty/);
  });
  it("keeps travel tiers and price visibility", () => {
    const html = render("travel", true);
    assert.match(html, /\$6\.50\/mile beyond 10/);
    assert.match(html, /\$65 \+ \$10\/mile beyond 20/);
    assert.match(html, /one-way driving distance/);
    assert.match(html, /nearest dollar/);
    assert.equal(render("travel").includes("$6.50"), false);
  });
  it("keeps treatment, sanitation and extra-care fee visibility", () => {
    assert.match(render("flea", true), /Medicated Treatment/);
    assert.match(render("flea", true), /Vehicle Sanitation/);
    assert.equal(render("flea").includes("From $20"), false);
    assert.match(render("special-handling", true), /Dematting Fee/);
    assert.match(render("special-handling", true), /Special Handling/);
    assert.equal(render("special-handling").includes("From $30"), false);
  });
});

it("includes photo consent and text-message terms when opened from appointment confirmation", () => {
  const html = renderToStaticMarkup(<BookingPoliciesModal open onClose={() => {}} includeConsentPolicies />);
  assert.match(html, /Photo policy/);
  assert.match(html, /photographing/);
  assert.match(html, /Text-message policies/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /href="\/privacy"/);
});

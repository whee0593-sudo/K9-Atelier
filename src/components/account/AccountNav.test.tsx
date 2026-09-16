import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountNavLinks } from "@/components/account/AccountNav";
import { buildAccountNavSummaries } from "@/lib/account-nav-summaries";

const summaries = buildAccountNavSummaries({
  profile: {
    firstName: "Jane",
    lastName: "Miller",
    email: "jane@example.com",
    phone: "+15551234567",
  },
  pets: [{ name: "Bella" }, { name: "Max" }],
  paymentMethodCount: 1,
  appointments: [
    {
      appointmentDate: "2026-08-12",
      status: "confirmed",
      addressStreet: "123 Palm Avenue",
      addressCity: "Orlando",
      addressZip: "32801",
    },
  ],
  referralCodes: ["BELLA-JANE-M"],
  availableCreditCents: 1800,
  today: "2026-09-16",
});

describe("AccountNavLinks", () => {
  it("puts a status summary to the right of each menu item except Password", () => {
    const html = renderToStaticMarkup(
      <AccountNavLinks pathname="/account" summaries={summaries} />,
    );

    assert.match(html, /Overview[\s\S]*Referral code: BELLA-JANE-M/);
    assert.match(html, /Personal Information[\s\S]*Completed/);
    assert.match(html, /Service Addresses[\s\S]*Completed/);
    assert.match(html, /My Pets[\s\S]*Bella, Max/);
    assert.match(html, /Payment Methods[\s\S]*Completed/);
    assert.match(html, /Referral Rewards[\s\S]*\$18\.00/);
    assert.match(html, /Booking History[\s\S]*Aug 12, 2026/);
    assert.match(html, /Password/);
    assert.equal(html.includes("Messages from K9 Atelier"), false);
    assert.equal(html.includes("aria-label=\"Password,"), false);
    assert.match(html, /aria-current="page"/);
  });

  it("keeps Password without a right-side summary", () => {
    const html = renderToStaticMarkup(
      <AccountNavLinks pathname="/account/password" summaries={summaries} />,
    );
    const passwordIndex = html.indexOf(">Password<");
    const afterPassword = html.slice(passwordIndex);
    assert.ok(passwordIndex > 0);
    assert.equal(afterPassword.includes("Completed"), false);
    assert.equal(afterPassword.includes("Referral code"), false);
  });
});

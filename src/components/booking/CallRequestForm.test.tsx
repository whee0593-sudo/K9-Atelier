import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CallRequestForm } from "./CallRequestForm";

describe("callback form", () => {
  it("collects name, phone and card-save consent without email, address, dog fields or password", () => {
    const html = renderToStaticMarkup(<CallRequestForm configured={false} phoneHref="tel:+15615933335" phoneLabel="561-593-3335" />);
    assert.match(html, /Full name/); assert.match(html, /Phone number/);
    assert.match(html, /No charge today/); assert.match(html, /not a confirmed appointment/);
    assert.equal((html.match(/<input\b/g) ?? []).length, 3);
    assert.doesNotMatch(html, /type="email"|type="password"|name="address"|name="breed"/);
  });
  it("does not pretend a card was saved when configuration is unavailable", () => {
    const html = renderToStaticMarkup(<CallRequestForm configured={false} phoneHref="tel:+15615933335" phoneLabel="561-593-3335" />);
    assert.match(html, /disabled=""[^>]*>Continue to Secure Card/);
    assert.match(html, /temporarily unavailable/); assert.match(html, /href="tel:\+15615933335"/);
    assert.doesNotMatch(html, /Your call request is received|Card saved securely\./);
  });
});

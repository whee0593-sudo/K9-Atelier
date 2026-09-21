import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PetBirthdayFields } from "@/components/account/PetBirthdayFields";
import { createDraftBookingPet } from "@/lib/booking-flow";
import {
  earliestAllowedDateOfBirth,
  latestAllowedDateOfBirth,
} from "@/lib/pet-age";

describe("PetBirthdayFields", () => {
  it("uses an unconstrained native date field so the year can be typed", () => {
    const html = renderToStaticMarkup(
      <PetBirthdayFields pet={createDraftBookingPet()} onChange={() => {}} />,
    );

    assert.match(html, /type="date"/);
    assert.match(html, /min="[^"]+"/);
    assert.match(html, /max="[^"]+"/);
    assert.match(html, new RegExp(`min="${earliestAllowedDateOfBirth()}"`));
    assert.match(html, new RegExp(`max="${latestAllowedDateOfBirth()}"`));
    assert.equal(html.includes("value=\"0019"), false);
  });

  it("does not wrap the unknown-date copy in a label, so only the box toggles", () => {
    const html = renderToStaticMarkup(
      <PetBirthdayFields pet={createDraftBookingPet()} onChange={() => {}} />,
    );

    assert.match(
      html,
      /<span[^>]*>I don(?:&apos;|&#x27;)t know the exact date<\/span>/,
    );
    assert.equal(/<label[^>]*>I don/.test(html), false);
    assert.match(html, /aria-labelledby="/);
  });

  it("does not add extra helper copy under the birthday fields", () => {
    const html = renderToStaticMarkup(
      <PetBirthdayFields pet={createDraftBookingPet()} onChange={() => {}} />,
    );

    assert.equal(html.includes("age-appropriate"), false);
    assert.equal(html.includes("important milestones"), false);
    assert.equal(html.includes("An estimate is perfectly fine"), false);
  });
});

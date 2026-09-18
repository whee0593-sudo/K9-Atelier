import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmAccountNextSteps } from "@/components/account/ConfirmAccountNextSteps";

describe("ConfirmAccountNextSteps", () => {
  it("sends confirmed customers to rabies status and payment", () => {
    const html = renderToStaticMarkup(
      <ConfirmAccountNextSteps petId="pet-1" petName="Bella" />,
    );
    assert.match(html, /rabies vaccination status for Bella/);
    assert.match(html, /You may also add a card on file/);
    assert.match(html, /Complete your profile/);
    assert.match(html, /href="\/account\/setup"/);
    assert.match(html, /href="\/account\/pets\?setup=1&amp;pet=pet-1"/);
    assert.match(html, /href="\/account\/payment\?setup=1"/);
  });

  it("keeps adding a card on the profile without requiring it to book", () => {
    const source = readFileSync(
      new URL("./PaymentMethodsManager.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /Saving a card is optional/);
    assert.equal(source.includes("before you reserve an appointment"), false);
    assert.match(source, /\+ Add a card/);
  });
});

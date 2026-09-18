import assert from "node:assert/strict";
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
    assert.match(html, /card on file/);
    assert.match(html, /Complete your profile/);
    assert.match(html, /href="\/account\/setup"/);
    assert.match(html, /href="\/account\/pets\?setup=1&amp;pet=pet-1"/);
    assert.match(html, /href="\/account\/payment\?setup=1"/);
  });
});

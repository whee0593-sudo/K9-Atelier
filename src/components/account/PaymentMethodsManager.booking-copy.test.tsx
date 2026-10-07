import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Elements } from "@stripe/react-stripe-js";
import { AddCardForm } from "@/components/account/PaymentMethodsManager";

const formProps = {
  clientSecret: "seti_test_secret",
  onSaved: () => {},
  onCancel: () => {},
};

function renderForm(bookingCardCopy = false) {
  return renderToStaticMarkup(
    <Elements stripe={null} options={{ clientSecret: "seti_test_secret" }}>
      <AddCardForm
        {...formProps}
        allowWallets
        bookingCardCopy={bookingCardCopy}
      />
    </Elements>,
  );
}

describe("AddCardForm booking card copy", () => {
  it("shows the reservation notes above the card field and Save Card", () => {
    const html = renderForm(true);
    const preference = html.indexOf("Payment Preference");
    const thanks = html.indexOf(
      "Thank you for choosing K9 Atelier. Cash or Zelle is always appreciated, while your card will be securely saved as a convenient backup payment method.",
    );
    const note = html.indexOf(
      "A card on file is required to reserve your appointment.",
    );
    const save = html.indexOf("Save Card");

    assert.ok(preference >= 0);
    assert.ok(thanks > preference);
    assert.ok(note > thanks);
    assert.ok(save > note);
    assert.match(html, /text-xs italic/);
    assert.match(html, /font-medium text-ink/);
  });

  it("keeps account add-card free of the booking reservation notes", () => {
    const html = renderForm(false);
    assert.equal(html.includes("Payment Preference"), false);
    assert.equal(html.includes("Cash or Zelle"), false);
    assert.equal(
      html.includes("A card on file is required to reserve your appointment."),
      false,
    );
    assert.match(html, /Save Card/);
  });
});

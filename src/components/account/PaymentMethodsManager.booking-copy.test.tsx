import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Elements } from "@stripe/react-stripe-js";
import { AddCardForm } from "@/components/account/PaymentMethodsManager";
import { BookingPaymentStep } from "@/components/booking/BookingPaymentStep";

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
  it("shows the short payment preference above Save Card", () => {
    const html = renderForm(true);
    const preference = html.indexOf("Payment Preference");
    const backup = html.indexOf(
      "Cash or Zelle is preferred. Your card is securely saved as a backup.",
    );
    const save = html.indexOf("Save Card");

    assert.ok(preference >= 0);
    assert.ok(backup > preference);
    assert.ok(save > backup);
    assert.equal(html.includes("Thank you for choosing K9 Atelier"), false);
    assert.equal(html.includes("Apple Pay or Google Pay"), false);
    assert.equal(html.includes("No charge at booking"), false);
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
    assert.match(html, /Apple Pay or Google Pay/);
    assert.match(html, /Save Card/);
  });
});

describe("BookingPaymentStep copy", () => {
  it("uses the short reservation copy and leaves out the old notices", () => {
    const html = renderToStaticMarkup(
      <BookingPaymentStep onBack={() => {}} onComplete={() => {}} />,
    );
    const title = html.indexOf("Secure Your Appointment");
    const subtitle = html.indexOf(
      "A card on file is required to reserve your appointment. No charge today.",
    );
    const finePrint = html.indexOf(
      "Two or more calendar days before: No fee.",
    );
    const continueButton = html.indexOf("Continue");

    assert.ok(title >= 0);
    assert.ok(subtitle > title);
    assert.ok(finePrint > subtitle);
    assert.ok(continueButton > finePrint);
    assert.equal(html.includes("Leave a card on file"), false);
    assert.equal(html.includes("No charge at booking"), false);
    assert.equal(html.includes("Apple Pay or Google Pay"), false);
    assert.equal(html.includes("Confirm Appointment"), false);
    assert.match(html, /text-xs italic/);
  });
});

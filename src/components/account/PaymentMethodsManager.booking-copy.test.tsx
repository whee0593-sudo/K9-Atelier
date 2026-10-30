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
    assert.match(html, /class="font-body text-base leading-relaxed text-ink">Cash or Zelle/);
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
    const preference = html.indexOf("We prefer cash or Zelle payment. Thank you!");
    const agreement = html.indexOf("I have read and agreed to");
    const continueButton = html.indexOf("Continue");

    assert.ok(title >= 0);
    assert.equal(html.includes(">Payment</p>"), false);
    assert.ok(subtitle > title);
    assert.ok(preference > subtitle);
    assert.ok(agreement > preference);
    assert.ok(continueButton > agreement);
    assert.match(html, /href="\/faq#fees-policies"/);
    assert.match(html, /type="checkbox" required=""/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>Continue<\/button>/);
    assert.equal(html.includes("Two or more calendar days before"), false);
    assert.equal(html.includes("Leave a card on file"), false);
    assert.equal(html.includes("No charge at booking"), false);
    assert.equal(html.includes("Apple Pay or Google Pay"), false);
    assert.equal(html.includes("Confirm Appointment"), false);
    assert.equal(html.includes("text-xs italic"), false);
  });
});

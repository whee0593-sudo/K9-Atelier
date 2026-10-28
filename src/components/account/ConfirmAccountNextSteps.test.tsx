import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmAccountForm } from "@/components/account/ConfirmAccountForm";
import { ConfirmAccountNextSteps } from "@/components/account/ConfirmAccountNextSteps";

import { AccountSetupPaymentStatus } from "./AccountSetupChecklist";
import { AccountSetupNotice } from "./AccountSetupNotice";

describe("payment setup states", () => {
  for (const hasCard of [true, false, null]) {
    it(`renders only the appropriate card state: ${hasCard}`, () => {
      const html = renderToStaticMarkup(<AccountSetupPaymentStatus hasCard={hasCard} error={null} />);
      assert.doesNotMatch(html, /rabies|vaccination|Step [12]/i);
      if (hasCard === true) { assert.match(html, /Your card is on file/); assert.doesNotMatch(html, /Add a card/); }
      else if (hasCard === false) { assert.match(html, /Add a card/); assert.doesNotMatch(html, /Your card is on file/); }
      else { assert.match(html, /Checking saved/); assert.doesNotMatch(html, /Add a card|Your card is on file/); }
    });
  }
  it("does not claim a missing card when checking fails", () => {
    const html = renderToStaticMarkup(<AccountSetupPaymentStatus hasCard={null} error="Could not check saved cards." />);
    assert.match(html, /role="alert"/); assert.match(html, /Review payment methods/); assert.doesNotMatch(html, /Add a card|Your card is on file/);
  });
  it("does not request vaccination details in setup notices", () => {
    for (const step of ["pets", "payment"] as const) assert.doesNotMatch(renderToStaticMarkup(<AccountSetupNotice step={step} />), /rabies|vaccination/i);
  });
});

describe("ConfirmAccountNextSteps", () => {
  it("offers payment management without vaccination tasks", () => {
    const html = renderToStaticMarkup(
      <ConfirmAccountNextSteps petId="pet-1" petName="Bella" />,
    );
    assert.doesNotMatch(html, /rabies|vaccination|account\/pets/i);
    assert.match(html, /card is on file/);
    assert.match(html, /Complete your profile/);
    assert.match(html, /href="\/account\/setup"/);
    assert.match(html, /href="\/account\/payment\?setup=1"/);
    assert.match(html, /Review payment method/);
    assert.match(html, /secured/);
  });
});

describe("ConfirmAccountForm payment gate", () => {
  it("asks for a card before the appointment can be secured", () => {
    const html = renderToStaticMarkup(
      <ConfirmAccountForm
        token="preview"
        preview={{
          requiresPassword: false,
          customer: { email: "ada@example.com", firstName: "Ada" },
          paymentMethods: [],
          appointment: {
            id: "11111111-1111-4111-8111-111111111111",
            customerId: "22222222-2222-4222-8222-222222222222",
            petId: "33333333-3333-4333-8333-333333333333",
            petName: "Bella",
            petBreed: "Poodle",
            serviceId: "signature-bath-care",
            serviceName: "Signature Bath & Care",
            addOnIds: [],
            addOnOptions: {},
            addressStreet: "100 Olive Ave",
            addressCity: "West Palm Beach",
            addressState: "FL",
            addressZip: "33401",
            travelDistanceMiles: 4,
            travelFee: 0,
            appointmentDate: "2026-09-18",
            appointmentTime: "10–11 AM",
            scheduledStart: 600,
            timePreference: "morning",
            timezone: "America/New_York",
            estimatedTotal: 95,
            newClientDeposit: 0,
            vaccinationStatusAtBooking: "missing",
            status: "pending_confirmation",
            confirmedAt: null,
            customerConfirmedAt: null,
            staffCreated: true,
            awaitingCustomerConfirm: true,
            createdAt: "2026-09-13T12:00:00.000Z",
          },
        }}
      />,
    );
    assert.match(html.replace(/<[^>]+>/g, ""), /Add a card to secure this appointment/);
    assert.match(html, /You will not be charged now/);
    assert.match(html, /Add a card/);
    assert.match(html, />Confirm<\/button>/);
  });
});

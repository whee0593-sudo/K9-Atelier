import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmAccountForm } from "@/components/account/ConfirmAccountForm";
import { ConfirmAccountNextSteps } from "@/components/account/ConfirmAccountNextSteps";

describe("ConfirmAccountNextSteps", () => {
  it("sends confirmed customers to rabies status and payment", () => {
    const html = renderToStaticMarkup(
      <ConfirmAccountNextSteps petId="pet-1" petName="Bella" />,
    );
    assert.match(html, /Rabies vaccination details for Bella are optional/);
    assert.match(html, /card is on file/);
    assert.match(html, /Complete your profile/);
    assert.match(html, /href="\/account\/setup"/);
    assert.match(html, /href="\/account\/pets\?setup=1&amp;pet=pet-1"/);
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
    assert.match(html, /Add a card to secure this appointment/);
    assert.match(html, /You will not be charged now/);
    assert.match(html, /Add a card/);
    assert.match(html, /Review and Confirm/);
  });
});

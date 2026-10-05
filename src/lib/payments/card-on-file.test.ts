import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cardSaveRejection,
  isCardExpired,
  offSessionCardSetupParams,
  readOffSessionAuthentication,
  readSucceededSetupIntentId,
  savedCardChargeConfirmation,
  withoutSetupIntentRedirect,
} from "@/lib/payments/card-on-file";

describe("saved card verification", () => {
  it("charges every saved card as an off-session merchant payment", () => {
    assert.deepEqual(savedCardChargeConfirmation(), {
      confirm: true,
      off_session: true,
    });
  });

  it("asks the bank to authenticate the card while the customer is saving it", () => {
    assert.deepEqual(offSessionCardSetupParams("cus_123"), {
      customer: "cus_123",
      usage: "off_session",
      payment_method_types: ["card"],
      payment_method_options: {
        card: { request_three_d_secure: "any" },
      },
    });
  });

  it("treats a card as expired only after its expiry month in New York", () => {
    const duringOctober = new Date("2026-10-31T23:30:00-04:00");
    const afterOctober = new Date("2026-11-01T00:30:00-04:00");
    assert.equal(isCardExpired(10, 2026, duringOctober), false);
    assert.equal(isCardExpired(10, 2026, afterOctober), true);
    assert.equal(isCardExpired(12, 2027, afterOctober), false);
  });

  it("rejects cards the bank did not verify", () => {
    const now = new Date("2026-10-05T12:00:00-04:00");
    assert.equal(
      cardSaveRejection(
        { exp_month: 12, exp_year: 2027, checks: { cvc_check: "pass" } },
        now,
      ),
      null,
    );
    assert.match(
      cardSaveRejection(
        { exp_month: 1, exp_year: 2020, checks: { cvc_check: "pass" } },
        now,
      ) ?? "",
      /expired/i,
    );
    assert.match(
      cardSaveRejection(
        { exp_month: 12, exp_year: 2027, checks: { cvc_check: "fail" } },
        now,
      ) ?? "",
      /security code/i,
    );
    assert.match(
      cardSaveRejection(
        {
          exp_month: 12,
          exp_year: 2027,
          checks: { address_postal_code_check: "fail" },
        },
        now,
      ) ?? "",
      /postal code/i,
    );
    assert.equal(
      cardSaveRejection(
        {
          exp_month: 12,
          exp_year: 2027,
          checks: { cvc_check: "unavailable" },
        },
        now,
      ),
      null,
    );
  });

  it("drops the bank redirect from the page address after the card is saved", () => {
    assert.equal(
      withoutSetupIntentRedirect(
        "https://k9atelier.com/book?step=pay&setup_intent=seti_abc&setup_intent_client_secret=secret&redirect_status=succeeded",
      ),
      "https://k9atelier.com/book?step=pay",
    );
  });

  it("keeps a bank redirect only when setup succeeded", () => {
    assert.equal(
      readSucceededSetupIntentId(
        "?setup_intent=seti_abc&redirect_status=succeeded",
      ),
      "seti_abc",
    );
    assert.equal(
      readSucceededSetupIntentId(
        "?setup_intent=seti_abc&redirect_status=failed",
      ),
      null,
    );
    assert.equal(
      readSucceededSetupIntentId("?setup_intent=pi_abc&redirect_status=succeeded"),
      null,
    );
  });

  it("surfaces a bank authentication challenge instead of a hard decline", () => {
    assert.deepEqual(
      readOffSessionAuthentication({
        code: "authentication_required",
        payment_intent: {
          id: "pi_123",
          status: "requires_action",
          client_secret: "pi_123_secret",
        },
      }),
      { paymentIntentId: "pi_123", clientSecret: "pi_123_secret" },
    );
    assert.equal(
      readOffSessionAuthentication({
        code: "card_declined",
        payment_intent: {
          id: "pi_123",
          status: "requires_payment_method",
          client_secret: "pi_123_secret",
        },
      }),
      null,
    );
  });
});

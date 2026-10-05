import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerCardWallets, manualCardWallets } from "@/lib/payments/card-wallets";

describe("card wallet options", () => {
  it("lets a customer save a card with Apple Pay or Google Pay", () => {
    assert.equal(customerCardWallets.applePay, "auto");
    assert.equal(customerCardWallets.googlePay, "auto");
    assert.equal(customerCardWallets.link, "never");
  });

  it("keeps staff card entry on a typed card", () => {
    assert.equal(manualCardWallets.applePay, "never");
    assert.equal(manualCardWallets.googlePay, "never");
    assert.equal(manualCardWallets.link, "never");
  });
});

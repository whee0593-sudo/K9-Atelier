import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import {
  buildCollectChargePaymentFields,
  collectReceiptPaymentLabel,
  isCashTender,
  readChargeTender,
} from "@/lib/charges/tender";

describe("collect checkout payment choice", () => {
  it("lists more than one saved card so checkout can switch from card A to card B", () => {
    const context = buildPreviewCollectContext();
    assert.ok(context.methods.length >= 2);
    assert.equal(context.selectedPaymentMethodId, context.methods[0]?.id);
    assert.notEqual(context.methods[1]?.id, context.selectedPaymentMethodId);
  });

  it("sends the selected saved card, a new card, or cash", () => {
    assert.deepEqual(
      buildCollectChargePaymentFields({
        tender: "card",
        useNewCard: false,
        paymentMethodId: "card-b",
      }),
      {
        tender: "card",
        useNewCard: false,
        paymentMethodId: "card-b",
      },
    );
    assert.deepEqual(
      buildCollectChargePaymentFields({
        tender: "card",
        useNewCard: true,
      }),
      {
        tender: "card",
        useNewCard: true,
        paymentMethodId: undefined,
      },
    );
    assert.deepEqual(buildCollectChargePaymentFields({ tender: "cash" }), {
      tender: "cash",
      useNewCard: false,
      paymentMethodId: undefined,
    });
  });

  it("labels cash receipts as Cash and card receipts by last4", () => {
    assert.equal(collectReceiptPaymentLabel({ tender: "cash" }), "Cash");
    assert.equal(
      collectReceiptPaymentLabel({
        tender: "card",
        method: {
          id: "card-b",
          brand: "mastercard",
          last4: "5555",
          expMonth: 8,
          expYear: 2029,
          isDefault: false,
        },
      }),
      "Mastercard ending in 5555",
    );
    assert.equal(isCashTender("cash"), true);
    assert.equal(readChargeTender("cash"), "cash");
    assert.equal(readChargeTender("card"), "card");
    assert.equal(readChargeTender(undefined), "card");
  });
});

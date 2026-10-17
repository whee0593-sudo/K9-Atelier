import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readMerchantFromAddress,
  readMerchantNotifyPhone,
} from "@/lib/communications/merchant-config";

describe("merchant notification config", () => {
  it("requires a verified sender that is not the owner inbox", () => {
    assert.equal(readMerchantFromAddress({}).ok, false);
    assert.equal(
      readMerchantFromAddress({
        MERCHANT_NOTIFY_FROM_EMAIL: "K9 Atelier <penny@k9atelier.com>",
      }).ok,
      false,
    );
    assert.equal(
      readMerchantFromAddress({
        MERCHANT_NOTIFY_FROM_EMAIL: "K9 Atelier <notices@example.com>",
      }).ok,
      false,
    );
    const from = readMerchantFromAddress({
      MERCHANT_NOTIFY_FROM_EMAIL: "K9 Atelier <notices@k9atelier.com>",
    });
    assert.equal(from.ok, true);
    if (from.ok) assert.equal(from.email, "notices@k9atelier.com");
  });

  it("reads only MERCHANT_NOTIFY_PHONE", () => {
    assert.equal(
      readMerchantNotifyPhone({ STAFF_VOICE_PHONE: "+15615550111" }),
      null,
    );
    assert.equal(
      readMerchantNotifyPhone({ MERCHANT_NOTIFY_PHONE: "+1 (561) 555-0199" }),
      "+15615550199",
    );
  });
});

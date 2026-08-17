import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidSmsPhone, normalizePhoneToE164 } from "@/lib/sms/phone";

describe("normalizePhoneToE164", () => {
  it("adds +1 for 10-digit US numbers", () => {
    assert.equal(normalizePhoneToE164("(561) 555-0123"), "+15615550123");
    assert.equal(normalizePhoneToE164("5615550123"), "+15615550123");
  });

  it("keeps a leading country code", () => {
    assert.equal(normalizePhoneToE164("15615550123"), "+15615550123");
    assert.equal(normalizePhoneToE164("+1 561 555 0123"), "+15615550123");
  });

  it("rejects incomplete numbers", () => {
    assert.equal(normalizePhoneToE164("555-0123"), null);
    assert.equal(normalizePhoneToE164(""), null);
    assert.equal(isValidSmsPhone("not a phone"), false);
  });
});

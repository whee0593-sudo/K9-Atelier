import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerYesReceivedSms,
  isCustomerYesReply,
  isIgnoredInboundReply,
  phonesMatch,
} from "@/lib/sms/inbound";

describe("inbound customer SMS", () => {
  it("accepts C, and still accepts YES from older texts", () => {
    assert.equal(isCustomerYesReply("C"), true);
    assert.equal(isCustomerYesReply("c!"), true);
    assert.equal(isCustomerYesReply("YES"), true);
    assert.equal(isCustomerYesReply("yes!"), true);
    assert.equal(isCustomerYesReply("Y"), true);
    assert.equal(isCustomerYesReply("yesterday"), false);
    assert.equal(isCustomerYesReply("NO"), false);
    assert.equal(isCustomerYesReply("CANCEL"), false);
    assert.equal(isCustomerYesReply("confirm"), false);
  });

  it("leaves STOP and HELP to Twilio", () => {
    assert.equal(isIgnoredInboundReply("STOP"), true);
    assert.equal(isIgnoredInboundReply("HELP"), true);
    assert.equal(isIgnoredInboundReply("YES"), false);
  });

  it("matches US numbers across formats", () => {
    assert.equal(phonesMatch("+15615550131", "(561) 555-0131"), true);
    assert.equal(phonesMatch("+15615550131", "+15615550132"), false);
  });

  it("thanks the customer without mixing staff booking language", () => {
    const body = buildCustomerYesReceivedSms({
      customerName: "Maya Patel",
      petName: "Daisy",
      dateLabel: "Wednesday, July 8, 2026",
    });
    assert.match(body, /we received your confirmation/);
    assert.equal(body.includes("YES"), false);
    assert.equal(body.includes("appointment is confirmed"), false);
  });
});

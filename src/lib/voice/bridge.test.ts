import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConnectCustomerTwiml,
  readVoiceBridgeTarget,
} from "@/lib/voice/bridge";

describe("voice bridge", () => {
  it("builds TwiML that dials the customer from the studio number", () => {
    const xml = buildConnectCustomerTwiml("+15615550131", "+15615933335");
    assert.match(xml, /Connecting you to the customer/);
    assert.match(xml, /callerId="\+15615933335"/);
    assert.match(xml, /<Number>\+15615550131<\/Number>/);
  });

  it("rejects a missing or expired bridge token", () => {
    assert.equal(readVoiceBridgeTarget({ to: "+15615550131" }), null);
    assert.equal(
      readVoiceBridgeTarget({
        to: "+15615550131",
        exp: String(Date.now() - 1000),
        sig: "abc",
      }),
      null,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildForwardCallTwiml,
  buildIncomingCallSms,
  buildWhisperSay,
  callerLabel,
} from "./inbound";

const known = {
  phone: "+15615550131",
  customer: {
    customerId: "cust-1",
    firstName: "Jane",
    name: "Jane Doe",
    phone: "+15615550131",
    petNames: ["Bella"],
  },
};

describe("inbound studio voice", () => {
  it("labels a matched caller as pet and first name", () => {
    assert.equal(callerLabel(known), "Bella · Jane");
    assert.equal(
      buildIncomingCallSms(known),
      "K9 ATELIER incoming: Bella · Jane +15615550131",
    );
    assert.equal(
      buildWhisperSay(known),
      "K9 Atelier transfer. Call from Jane. Pets: Bella.",
    );
  });

  it("speaks last four digits for an unlisted caller", () => {
    const unknown = { phone: "+15615550131", customer: null };
    assert.equal(callerLabel(unknown), "unlisted caller · 0131");
    assert.match(
      buildWhisperSay(unknown),
      /not in your customer list\. Ending in 0 1 3 1\./,
    );
  });

  it("forwards to the staff phone with a whisper URL", () => {
    const xml = buildForwardCallTwiml(
      "+15615550999",
      "https://k9atelier.com/api/voice/whisper?say=hi&exp=1&sig=abc",
      "+15615933335",
    );
    assert.match(xml, /callerId="\+15615933335"/);
    assert.match(xml, /<Number url="https:\/\/k9atelier.com\/api\/voice\/whisper\?say=hi&amp;exp=1&amp;sig=abc">\+15615550999<\/Number>/);
    assert.match(xml, /We could not reach K9 Atelier/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildForwardCallTwiml,
  buildIncomingCallSms,
  buildWhisperSay,
  callerLabel,
  shouldSendMissedCallSms,
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

  it("keeps unknown callers as unknown number", () => {
    const unknown = { phone: "+15615550131", customer: null };
    assert.equal(callerLabel(unknown), "an unknown number");
    assert.equal(
      buildWhisperSay(unknown),
      "K9 Atelier transfer. Call from an unknown number.",
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

  it("asks Twilio to report the dial result when an action URL is set", () => {
    const xml = buildForwardCallTwiml(
      "+15615550999",
      "https://k9atelier.com/api/voice/whisper?say=hi&exp=1&sig=abc",
      "+15615933335",
      "https://k9atelier.com/api/voice/dial-status",
    );
    assert.match(xml, /action="https:\/\/k9atelier.com\/api\/voice\/dial-status"/);
    assert.doesNotMatch(xml, /We could not reach K9 Atelier/);
  });

  it("sends the missed-call text only when the staff line is not answered", () => {
    assert.equal(shouldSendMissedCallSms("no-answer"), true);
    assert.equal(shouldSendMissedCallSms("busy"), true);
    assert.equal(shouldSendMissedCallSms("failed"), true);
    assert.equal(shouldSendMissedCallSms("canceled"), true);
    assert.equal(shouldSendMissedCallSms("completed"), false);
    assert.equal(shouldSendMissedCallSms("answered"), false);
  });
});

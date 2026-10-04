import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("BookingOwnerStep referral source", () => {
  const source = readFileSync(new URL("./BookingOwnerStep.tsx", import.meta.url), "utf8");

  it("asks new customers how they heard about K9 Atelier near continue", () => {
    assert.match(source, /How did you hear about K9 Atelier\? \*/);
    assert.match(source, /We&apos;d love to know how you found us\./);
    assert.match(source, /Who can we thank for referring you\?/);
    assert.match(source, /Name \(optional\)/);
    assert.match(source, /REFERRAL_SOURCE_OPTIONS/);
    assert.match(source, /\{!loggedIn \? \(/);
    assert.match(source, /referralSource/);
  });

  it("does not put the question on the password field block", () => {
    const passwordIdx = source.indexOf("Create a login password");
    const referralIdx = source.indexOf("How did you hear about K9 Atelier?");
    assert.ok(passwordIdx > 0);
    assert.ok(referralIdx > passwordIdx);
  });
});

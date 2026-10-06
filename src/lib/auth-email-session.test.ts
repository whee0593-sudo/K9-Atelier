import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEmailSignInLink } from "@/lib/auth-email-session";

describe("email sign-in links", () => {
  it("rejects magic-link and email OTP sign-in types", () => {
    assert.equal(isEmailSignInLink("magiclink"), true);
    assert.equal(isEmailSignInLink("email"), true);
  });

  it("keeps password recovery and account confirmation", () => {
    assert.equal(isEmailSignInLink("recovery"), false);
    assert.equal(isEmailSignInLink("signup"), false);
    assert.equal(isEmailSignInLink("invite"), false);
    assert.equal(isEmailSignInLink("email_change"), false);
    assert.equal(isEmailSignInLink(null), false);
    assert.equal(isEmailSignInLink(undefined), false);
  });
});

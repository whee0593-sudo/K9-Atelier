import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasEmailAuthTokens, isEmailSignInLink } from "@/lib/auth-email-session";

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

it("keeps appointment tokens out of the global authentication redirect", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const path of ["/confirm-account", "/confirm-account/appointment"]) {
      Object.defineProperty(globalThis, "window", {configurable:true,value:{location:new URL(`https://k9atelier.com${path}?token=${"a".repeat(64)}`)}});
      assert.equal(hasEmailAuthTokens(),false);
    }
    for (const url of ["https://k9atelier.com/auth/confirm?token=abc&type=signup", "https://k9atelier.com/confirm-account/appointment?code=auth-code", "https://k9atelier.com/confirm-account/appointment#access_token=auth-token"]) {
      Object.defineProperty(globalThis,"window",{configurable:true,value:{location:new URL(url)}});
      assert.equal(hasEmailAuthTokens(),true);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis,"window",previous);
    else Reflect.deleteProperty(globalThis,"window");
  }
});

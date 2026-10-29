import assert from "node:assert/strict";
import { it } from "node:test";
import { verifySignupLink } from "./verify-signup";

function fixture(error: unknown = null, confirmed = true) {
  const calls: unknown[] = [];
  const result = { error, data: { user: confirmed ? { email_confirmed_at: "2026-10-29" } : null } };
  return { calls, client: { auth: {
    async verifyOtp(input: unknown) { calls.push(input); return result; },
    async setSession(input: unknown) { calls.push(input); return result; },
  } } };
}
it("verifies signup in a fresh browser without any stored verifier or session", async () => {
  const f = fixture();
  assert.equal(await verifySignupLink(new URL("https://example.com/auth/confirm?token_hash=single-use&type=signup"), () => f.client), true);
  assert.deepEqual(f.calls, [{token_hash: "single-use", type: "signup"}]);
});
it("rejects recovery, email login, errors, PKCE-only links and missing tokens", async () => {
  for (const suffix of ["?token_hash=x&type=recovery", "?token_hash=x&type=email", "?code=x", "?type=signup", "?token_hash=x&type=signup&error=expired", "#error=expired&type=signup"]) {
    const f = fixture();
    assert.equal(await verifySignupLink(new URL("https://example.com/auth/confirm" + suffix), () => f.client), false);
    assert.deepEqual(f.calls, []);
  }
});
it("never treats an expired or reused token as success", async () => {
  const f = fixture(new Error("expired"));
  assert.equal(await verifySignupLink(new URL("https://example.com/auth/confirm?token_hash=x&type=signup"), () => f.client), false);
});
it("requires verified user evidence", async () => {
  const f = fixture(null, false);
  assert.equal(await verifySignupLink(new URL("https://example.com/auth/confirm?token_hash=x&type=signup"), () => f.client), false);
});
it("supports non-PKCE signup links from the legacy email template", async () => {
  const f = fixture();
  assert.equal(await verifySignupLink(new URL("https://example.com/auth/confirm#type=signup&access_token=a&refresh_token=b"), () => f.client), true);
});
it("handles network failures as verification failures", async () => {
  assert.equal(await verifySignupLink(new URL("https://example.com/auth/confirm?token_hash=x&type=signup"), () => { throw Error("offline"); }), false);
});

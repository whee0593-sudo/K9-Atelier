import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authErrorMessage } from "@/lib/auth/login-errors";
import {
  ACCOUNT_FROZEN_MESSAGE,
  isFrozenAuthError,
  isFrozenAuthUser,
} from "@/lib/auth/frozen-account";

describe("frozen account copy", () => {
  it("uses the owner contact message", () => {
    assert.equal(
      ACCOUNT_FROZEN_MESSAGE,
      "Your account has been frozen. Please contact the administrator at penny@k9atelier.com",
    );
  });

  it("maps banned login errors to the frozen message", () => {
    assert.equal(isFrozenAuthError("User is banned"), true);
    assert.equal(authErrorMessage("User is banned"), ACCOUNT_FROZEN_MESSAGE);
  });

  it("detects frozen metadata and future bans", () => {
    assert.equal(isFrozenAuthUser({ app_metadata: { frozen: true } }), true);
    assert.equal(
      isFrozenAuthUser({
        banned_until: new Date(Date.now() + 60_000).toISOString(),
      }),
      true,
    );
    assert.equal(
      isFrozenAuthUser({
        banned_until: new Date(Date.now() - 60_000).toISOString(),
      }),
      false,
    );
  });
});

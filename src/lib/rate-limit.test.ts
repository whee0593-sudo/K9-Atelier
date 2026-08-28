import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consumeRateLimit } from "@/lib/rate-limit";

describe("consumeRateLimit", () => {
  it("allows requests under the limit", () => {
    const store = new Map<string, number[]>();
    const first = consumeRateLimit({
      key: "test",
      limit: 2,
      windowMs: 1000,
      now: 1000,
      store,
    });
    const second = consumeRateLimit({
      key: "test",
      limit: 2,
      windowMs: 1000,
      now: 1100,
      store,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
  });

  it("blocks when the window is full", () => {
    const store = new Map<string, number[]>();
    consumeRateLimit({
      key: "test",
      limit: 2,
      windowMs: 1000,
      now: 1000,
      store,
    });
    consumeRateLimit({
      key: "test",
      limit: 2,
      windowMs: 1000,
      now: 1100,
      store,
    });
    const blocked = consumeRateLimit({
      key: "test",
      limit: 2,
      windowMs: 1000,
      now: 1200,
      store,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.retryAfterSec, 1);
    }
  });

  it("resets after the window expires", () => {
    const store = new Map<string, number[]>();
    consumeRateLimit({
      key: "test",
      limit: 1,
      windowMs: 1000,
      now: 1000,
      store,
    });
    const later = consumeRateLimit({
      key: "test",
      limit: 1,
      windowMs: 1000,
      now: 2000,
      store,
    });
    assert.equal(later.ok, true);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as session } from "@/app/api/call-requests/session/route";
import { POST as setup } from "@/app/api/call-requests/setup/route";
import { POST as complete } from "@/app/api/call-requests/complete/route";
import { GET as cron } from "@/app/api/cron/call-request-notices/route";
import { GET as stripeReturn } from "@/app/api/call-requests/return/route";

describe("callback API fail-closed boundaries", () => {
  const request = (origin: string) => new Request("https://k9atelier.com/api/call-requests/setup", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: "{}" });
  it("blocks cross-site mutations before any provider or database operation", async () => {
    for (const route of [session, setup, complete]) assert.equal((await route(request("https://evil.example"))).status, 403);
  });
  it("does not accept a request when the feature is not configured", async () => {
    const previous = process.env.CALL_REQUESTS_ENABLED; delete process.env.CALL_REQUESTS_ENABLED;
    try {
      for (const route of [session, setup, complete]) {
        const response = await route(request("https://k9atelier.com"));
        assert.equal(response.status, 503);
        assert.equal((await response.json()).received, undefined);
      }
    } finally { if (previous !== undefined) process.env.CALL_REQUESTS_ENABLED = previous; }
  });
  it("rejects unsigned notification replay", async () => {
    assert.equal((await cron(new Request("https://k9atelier.com/api/cron/call-request-notices"))).status, 401);
  });
  it("removes Stripe query secrets before returning to the analytics-enabled page", async () => {
    const response = await stripeReturn(new Request("https://k9atelier.com/api/call-requests/return?setup_intent=seti_test&setup_intent_client_secret=test_secret&redirect_status=succeeded"));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "https://k9atelier.com/request-a-call");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

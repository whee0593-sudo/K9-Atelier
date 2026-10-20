import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSameOrigin, callContact, completeStoredCallRequest, smallJson, verifiedCallCard, type CallCompletionPorts } from "./core";

describe("callback contact and request validation", () => {
  it("requires only a name, callable phone format and explicit consent", () => {
    assert.deepEqual(callContact({ name: "  Pat   Smith ", phone: "(561) 593-3335", consent: true }), { name: "Pat Smith", phone: "+15615933335" });
    assert.equal(callContact({ name: "Pat Smith", phone: "+44 20 7946 0958", consent: true }).phone, "+442079460958");
    for (const phone of ["123", "1234567890", "0000000000", "call 5615933335", "+000000000", "5615933335 ext 1"]) assert.throws(() => callContact({ name: "Pat Smith", phone, consent: true }));
    for (const consent of [false, "true", undefined]) assert.throws(() => callContact({ name: "Pat Smith", phone: "5615933335", consent }));
    assert.throws(() => callContact({ name: "", phone: "5615933335", consent: true }));
  });
  it("rejects cross-origin, missing-origin and oversized requests", async () => {
    assertSameOrigin(new Request("https://k9atelier.com/api/call-requests/setup", { headers: { origin: "https://k9atelier.com" } }));
    for (const origin of ["https://evil.example", "null", ""]) assert.throws(() => assertSameOrigin(new Request("https://k9atelier.com/api/call-requests/setup", { headers: { origin } })));
    const make = (body: string) => new Request("https://k9atelier.com/api/call-requests/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.deepEqual(await smallJson(make('{"name":"Pat"}')), { name: "Pat" });
    await assert.rejects(smallJson(make("[]")));
    await assert.rejects(smallJson(make('{"name":"' + "a".repeat(5000) + '"}')));
    await assert.rejects(smallJson(make("invalid json")));
  });
});

describe("callback completion recovery", () => {
  const row = { id: "request-a", status: "draft", consent_at: "2026-10-20T12:00:00Z", name: "Pat Smith", phone: "+15615933335", stripe_customer_id: "cus_a", stripe_setup_intent_id: "seti_a" };
  const setup = { id: "seti_a", status: "succeeded", usage: "off_session", customer: "cus_a", payment_method: "pm_a", metadata: { call_request_id: "request-a" } };
  const method = { id: "pm_a", type: "card", customer: "cus_a", card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 } };
  function ports(overrides: Partial<CallCompletionPorts> = {}): CallCompletionPorts {
    return { loadSetup: async () => setup, loadMethod: async () => method, persist: async () => true, alreadyReceived: async () => false, notify: async () => {}, ...overrides };
  }
  it("does not report success or notify if saving the request fails after Stripe succeeds", async () => {
    let notices = 0;
    await assert.rejects(completeStoredCallRequest(row, ports({ persist: async () => { throw new Error("database unavailable"); }, notify: async () => { notices++; } })), /database unavailable/);
    assert.equal(notices, 0);
    await completeStoredCallRequest(row, ports({ notify: async () => { notices++; } }));
    assert.equal(notices, 1);
  });
  it("accepts a concurrent completion only when another writer actually saved it", async () => {
    await assert.rejects(completeStoredCallRequest(row, ports({ persist: async () => false })), /call_complete_not_saved/);
    await completeStoredCallRequest(row, ports({ persist: async () => false, alreadyReceived: async () => true }));
  });
  it("never repeats Stripe or storage work for a previously received request", async () => {
    const fail = async () => { throw new Error("must not be called"); };
    await completeStoredCallRequest({ ...row, status: "requested" }, { loadSetup: fail, loadMethod: fail, persist: fail, alreadyReceived: fail, notify: fail });
  });
  it("keeps a durably saved request successful when the independent notice fails", async () => {
    await completeStoredCallRequest(row, ports({ notify: async () => { throw new Error("provider unavailable"); } }));
  });
  it("does not persist or notify a request with unsuccessful card authentication", async () => {
    const fail = async () => { throw new Error("must not persist or notify"); };
    await assert.rejects(completeStoredCallRequest(row, ports({ loadSetup: async () => ({ ...setup, status: "requires_action" }), persist: fail, notify: fail })), /card has not been saved/);
  });
});

describe("callback saved-card ownership", () => {
  const row = { id: "request-a", stripe_customer_id: "cus_a", stripe_setup_intent_id: "seti_a" };
  const setup = { id: "seti_a", status: "succeeded", usage: "off_session", customer: "cus_a", payment_method: "pm_a", metadata: { call_request_id: "request-a" } };
  const method = { id: "pm_a", type: "card", customer: "cus_a", card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 } };
  it("returns only Stripe identifiers and masked card fields", () => {
    assert.deepEqual(verifiedCallCard(row, setup, method), { stripe_payment_method_id: "pm_a", card_brand: "visa", card_last4: "4242", card_exp_month: 12, card_exp_year: 2030 });
  });
  it("rejects failed authentication, another session, customer, intent, method or non-card", () => {
    for (const patch of [{ status: "requires_action" }, { status: "processing" }, { usage: "on_session" }, { id: "seti_other" }, { customer: "cus_other" }, { payment_method: "pm_other" }, { metadata: { call_request_id: "request-b" } }]) assert.throws(() => verifiedCallCard(row, { ...setup, ...patch }, method));
    assert.throws(() => verifiedCallCard(row, setup, { ...method, customer: "cus_other" }));
    assert.throws(() => verifiedCallCard(row, setup, { ...method, type: "us_bank_account", card: null }));
    assert.throws(() => verifiedCallCard({ ...row, stripe_customer_id: null }, setup, method));
  });
});

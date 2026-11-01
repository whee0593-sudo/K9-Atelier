import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerYesReceivedSms,
  isCustomerYesReply,
  isIgnoredInboundReply,
  phonesMatch,
  customerReplyConfirmationVisit,
  persistCustomerReplyConfirmation,
} from "@/lib/sms/inbound";
import { buildPreviewCollectContext } from "@/lib/charges/preview";

describe("inbound customer SMS", () => {
  const base = buildPreviewCollectContext().appointment;
  const pending = (id: string, name: string, visitId = "staff-visit") => ({
    ...base, id, petId: id, petName: name, visitId,
    staffCreated: true, status: "pending_confirmation" as const, customerConfirmedAt: null,
  });

  it("confirms all dogs on the selected visit and leaves other visits alone", async () => {
    const rows = [pending("molly", "Molly"), pending("bella", "Bella"), pending("other", "Other", "other-visit")];
    const visit = customerReplyConfirmationVisit(rows)!;
    assert.equal(visit.petName, "Molly and Bella");
    const outcome = await persistCustomerReplyConfirmation(visit, async (ids, customerId, patch) => {
      assert.deepEqual(ids, ["molly", "bella"]);
      assert.equal(customerId, base.customerId);
      assert.equal(patch.status, "confirmed");
      assert.ok(patch.customer_confirmed_at);
      return { data: ids.map((id) => ({ id })), error: null };
    });
    assert.equal(outcome, "confirmed");
  });

  it("does not repeat confirmation after a previous C or concurrent reply", async () => {
    const row = { ...pending("molly", "Molly"), status: "confirmed" as const, customerConfirmedAt: new Date().toISOString() };
    assert.equal(await persistCustomerReplyConfirmation(customerReplyConfirmationVisit([row])!, async () => {
      assert.fail("already confirmed visits must not be rewritten");
    }), "already");
    assert.equal(await persistCustomerReplyConfirmation(customerReplyConfirmationVisit([pending("molly", "Molly")])!, async () => ({ data: [], error: null })), "already");
  });

  it("does not confirm another visit when C is repeated for the latest request", () => {
    const confirmed = { ...pending("molly", "Molly", "requested"), status: "confirmed" as const, customerConfirmedAt: new Date().toISOString() };
    const next = pending("next", "Daisy", "next-visit");
    assert.equal(customerReplyConfirmationVisit([next, confirmed], { visit_id: "requested" })?.appointment.id, "molly");
  });

  it("reports storage failure instead of acknowledging a confirmation", async () => {
    const visit = customerReplyConfirmationVisit([pending("molly", "Molly")])!;
    assert.equal(await persistCustomerReplyConfirmation(visit, async () => ({ data: null, error: { message: "unavailable" } })), "failed");
    assert.equal(await persistCustomerReplyConfirmation(visit, async () => { throw new Error("unavailable"); }), "failed");
  });

  it("preserves already-confirmed customer bookings and handles no match", () => {
    const row = { ...pending("own", "Daisy"), staffCreated: false, status: "confirmed" as const };
    assert.equal(customerReplyConfirmationVisit([row])?.appointment.status, "confirmed");
    assert.equal(customerReplyConfirmationVisit([]), null);
  });
  it("accepts C, and still accepts YES from older texts", () => {
    assert.equal(isCustomerYesReply("C"), true);
    assert.equal(isCustomerYesReply("c!"), true);
    assert.equal(isCustomerYesReply("YES"), true);
    assert.equal(isCustomerYesReply("yes!"), true);
    assert.equal(isCustomerYesReply("Y"), true);
    assert.equal(isCustomerYesReply("yesterday"), false);
    assert.equal(isCustomerYesReply("NO"), false);
    assert.equal(isCustomerYesReply("CANCEL"), false);
    assert.equal(isCustomerYesReply("confirm"), false);
  });

  it("leaves STOP and HELP to Twilio", () => {
    assert.equal(isIgnoredInboundReply("STOP"), true);
    assert.equal(isIgnoredInboundReply("HELP"), true);
    assert.equal(isIgnoredInboundReply("YES"), false);
  });

  it("matches US numbers across formats", () => {
    assert.equal(phonesMatch("+15615550131", "(561) 555-0131"), true);
    assert.equal(phonesMatch("+15615550131", "+15615550132"), false);
  });

  it("thanks the customer without mixing staff booking language", () => {
    const body = buildCustomerYesReceivedSms({
      customerName: "Maya Patel",
      petName: "Daisy",
      dateLabel: "Wednesday, July 8, 2026",
    });
    assert.match(body, /we received your confirmation/);
    assert.equal(body.includes("YES"), false);
    assert.equal(body.includes("appointment is confirmed"), false);
  });
});

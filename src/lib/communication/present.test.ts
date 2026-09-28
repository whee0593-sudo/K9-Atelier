import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  answeredFromStatus,
  callBannerLabel,
  chooseInboxPreview,
  communicationBadgeCount,
  communicationMessageBody,
  endedCallLabel,
  formatActivityAge,
  formatDisplayPhone,
  formatMissedCallWhen,
  liveCallLabel,
  matchesInboxFilter,
  mergeCallStatus,
  messageListPreview,
  parseDurationSeconds,
  statusFromCustomerLeg,
  statusFromParentCallback,
  type InboxRow,
} from "./present";

const NOW = Date.parse("2026-09-28T14:50:00.000Z");

function row(partial: Partial<InboxRow> & Pick<InboxRow, "id">): InboxRow {
  return {
    phoneDisplay: "(561) 555-1234",
    title: "Tia",
    petNames: "Milo",
    preview: "“Hello”",
    timeLabel: "2 min",
    activityAt: "2026-09-28T14:48:00.000Z",
    unread: false,
    missed: false,
    unknown: false,
    hasMessage: true,
    hasCall: false,
    customerId: "customer-1",
    ...partial,
  };
}

describe("communication presentation", () => {
  it("formats US numbers and unknown message bodies", () => {
    assert.equal(formatDisplayPhone("+15615551234"), "(561) 555-1234");
    assert.equal(formatDisplayPhone("5615551234"), "(561) 555-1234");
    assert.equal(communicationMessageBody("  Hi there  "), "Hi there");
    assert.equal(communicationMessageBody("", 1), "Photo");
    assert.equal(communicationMessageBody("", 2), "2 photos");
    assert.equal(messageListPreview("Thank you! See you Tuesday."), "“Thank you! See you Tuesday.”");
  });

  it("uses short ages and a missed-call clock", () => {
    assert.equal(formatActivityAge("2026-09-28T14:48:00.000Z", NOW), "2 min");
    assert.equal(formatActivityAge("2026-09-28T14:38:00.000Z", NOW), "12 min");
    assert.equal(formatActivityAge("2026-09-28T13:50:00.000Z", NOW), "1 hr");
    assert.equal(formatActivityAge("2026-09-28T12:50:00.000Z", NOW), "2 hr");
    assert.equal(
      formatMissedCallWhen("2026-09-28T14:42:00.000Z", new Date(NOW)),
      "Today · 10:42 AM",
    );
  });

  it("keeps missed calls visible until a newer inbound text arrives", () => {
    const missed = chooseInboxPreview({
      missedUnhandled: true,
      message: {
        at: "2026-09-28T14:43:00.000Z",
        direction: "outbound",
        body: "K9 ATELIER: Thank you for calling.",
      },
      call: {
        at: "2026-09-28T14:42:00.000Z",
        direction: "inbound",
        status: "no-answer",
        answered: false,
      },
    });
    assert.equal(missed.preview, "Missed Call");

    const replied = chooseInboxPreview({
      missedUnhandled: true,
      message: {
        at: "2026-09-28T14:45:00.000Z",
        direction: "inbound",
        body: "Hi, do you have availability for my Yorkie?",
      },
      call: {
        at: "2026-09-28T14:42:00.000Z",
        direction: "inbound",
        status: "no-answer",
        answered: false,
      },
    });
    assert.equal(replied.preview, "“Hi, do you have availability for my Yorkie?”");
  });

  it("counts unread conversations and unhandled missed calls", () => {
    assert.equal(
      communicationBadgeCount({ unreadConversations: 2, unhandledMissedCalls: 1 }),
      3,
    );
  });

  it("filters the inbox", () => {
    const rows = [
      row({ id: "sms", hasMessage: true, hasCall: false, unread: true }),
      row({ id: "call", hasMessage: false, hasCall: true, missed: true, unread: false }),
      row({ id: "both", hasMessage: true, hasCall: true, unread: false, missed: false }),
    ];
    assert.deepEqual(
      rows.filter((item) => matchesInboxFilter(item, "messages")).map((item) => item.id),
      ["sms", "both"],
    );
    assert.deepEqual(
      rows.filter((item) => matchesInboxFilter(item, "calls")).map((item) => item.id),
      ["call", "both"],
    );
    assert.deepEqual(
      rows.filter((item) => matchesInboxFilter(item, "unread")).map((item) => item.id),
      ["sms", "call"],
    );
  });

  it("moves callback status forward and labels the live call", () => {
    assert.equal(mergeCallStatus("ringing", "connecting"), "connecting");
    assert.equal(mergeCallStatus("connecting", "ringing"), "connecting");
    assert.equal(mergeCallStatus("connecting", "in-progress"), "in-progress");
    assert.equal(mergeCallStatus("completed", "ringing"), "completed");
    assert.equal(statusFromParentCallback("in-progress"), "connecting");
    assert.equal(statusFromCustomerLeg("answered"), "in-progress");
    assert.equal(statusFromCustomerLeg("no-answer"), "no-answer");
    assert.equal(answeredFromStatus("in-progress", null), true);
    assert.equal(answeredFromStatus("no-answer", null), false);
    assert.equal(answeredFromStatus("completed", true), true);
    assert.equal(liveCallLabel("ringing"), "Calling…");
    assert.equal(liveCallLabel("connecting"), "Connecting…");
    assert.equal(liveCallLabel("in-progress"), "Connected");
    assert.equal(endedCallLabel(), "Call ended");
    assert.equal(
      callBannerLabel({
        status: "completed",
        endedAt: new Date(NOW - 5_000).toISOString(),
        now: NOW,
      }),
      "Call ended",
    );
    assert.equal(parseDurationSeconds("42"), 42);
    assert.equal(parseDurationSeconds("nope"), null);
  });
});

describe("communication migration", () => {
  const sql = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260928015000_communication_inbox.sql",
    ),
    "utf8",
  );

  it("stores conversations, messages, and calls for staff only", () => {
    for (const name of [
      "communication_conversations",
      "communication_messages",
      "communication_calls",
    ]) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public.${name}`));
      assert.match(sql, new RegExp(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY`));
      assert.match(sql, new RegExp(`${name}_select_staff`));
    }
    assert.match(sql, /phone_number text NOT NULL/);
    assert.match(sql, /twilio_message_sid text/);
    assert.match(sql, /twilio_call_sid text/);
    assert.match(sql, /unread_count integer NOT NULL DEFAULT 0/);
    assert.match(sql, /answered boolean/);
    assert.match(sql, /private\.is_staff\(\)/);
    assert.doesNotMatch(sql, /FOR INSERT/);
  });
});

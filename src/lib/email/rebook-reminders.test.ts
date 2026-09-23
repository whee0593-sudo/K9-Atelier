import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasOpenFutureAppointment,
  isOpenFutureAppointment,
  isRebookReminderDue,
  rebookReminderLookupRange,
  runRebookReminderJob,
  type FutureAppointmentSnapshot,
  type RebookReminderCandidate,
  type RebookReminderJobDeps,
} from "./rebook-reminders";

const TEN_AM = new Date("2026-09-23T14:00:00.000Z");

function candidate(
  patch: Partial<RebookReminderCandidate> = {},
): RebookReminderCandidate {
  return {
    id: "apt-1",
    customerId: "cust-1",
    appointmentStatus: "confirmed",
    serviceEndedAt: "2026-09-02T16:00:00.000Z",
    reminderStatus: null,
    petName: "Lychee",
    customerEmail: "sarah@example.com",
    customerFirstName: "Sarah",
    ...patch,
  };
}

function future(
  patch: Partial<FutureAppointmentSnapshot> = {},
): FutureAppointmentSnapshot {
  return {
    id: "apt-future",
    status: "confirmed",
    appointmentDate: "2026-09-30",
    serviceEndedAt: null,
    ...patch,
  };
}

function harness(options: {
  now?: Date;
  emailConfigured?: boolean;
  storageConfigured?: boolean;
  due?: RebookReminderCandidate[];
  futureChecks?: FutureAppointmentSnapshot[][];
  claim?: boolean;
  send?: boolean;
}) {
  const calls: string[] = [];
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  let futureIndex = 0;
  const futureChecks = options.futureChecks ?? [[]];
  const deps: RebookReminderJobDeps = {
    now: options.now ?? TEN_AM,
    isEmailConfigured: () => options.emailConfigured ?? true,
    isStorageConfigured: () => options.storageConfigured ?? true,
    loadDue: async () => {
      calls.push("load");
      return options.due ?? [candidate()];
    },
    loadFuture: async () => {
      calls.push("future");
      const next = futureChecks[Math.min(futureIndex, futureChecks.length - 1)];
      futureIndex += 1;
      return next ?? [];
    },
    claim: async () => {
      calls.push("claim");
      return options.claim ?? true;
    },
    markSkipped: async () => {
      calls.push("skip");
      return true;
    },
    markSent: async (_id, sentAt) => {
      calls.push(`sent:${sentAt}`);
      return true;
    },
    release: async () => {
      calls.push("release");
    },
    send: async (message) => {
      calls.push("send");
      sent.push(message);
      return options.send ?? true;
    },
  };
  return { deps, calls, sent };
}

describe("rebook reminder timing", () => {
  it("is due 21 days after the completion date, and the next day if that run was missed", () => {
    const completed = candidate();
    assert.equal(isRebookReminderDue(completed, "2026-09-23"), true);
    assert.equal(
      isRebookReminderDue(
        candidate({ serviceEndedAt: "2026-09-01T16:00:00.000Z" }),
        "2026-09-23",
      ),
      true,
    );
    assert.equal(
      isRebookReminderDue(
        candidate({ serviceEndedAt: "2026-09-03T16:00:00.000Z" }),
        "2026-09-23",
      ),
      false,
    );
    assert.equal(
      isRebookReminderDue(
        candidate({ serviceEndedAt: "2026-08-31T16:00:00.000Z" }),
        "2026-09-23",
      ),
      false,
    );
  });

  it("uses the completion timestamp, not a reminder that was already recorded", () => {
    assert.equal(
      isRebookReminderDue(
        candidate({
          serviceEndedAt: "2026-09-12T16:00:00.000Z",
        }),
        "2026-09-23",
      ),
      false,
    );
    assert.equal(
      isRebookReminderDue(
        candidate({ reminderStatus: "sent" }),
        "2026-09-23",
      ),
      false,
    );
    assert.equal(
      isRebookReminderDue(
        candidate({ reminderStatus: "skipped" }),
        "2026-09-23",
      ),
      false,
    );
    assert.equal(
      isRebookReminderDue(
        candidate({ appointmentStatus: "cancelled" }),
        "2026-09-23",
      ),
      false,
    );
    assert.equal(
      isRebookReminderDue(candidate({ serviceEndedAt: null }), "2026-09-23"),
      false,
    );
  });

  it("looks up the completion window for today and the one-day catch-up", () => {
    assert.deepEqual(rebookReminderLookupRange("2026-09-23"), {
      start: "2026-09-01T04:00:00.000Z",
      end: "2026-09-03T04:00:00.000Z",
    });
  });
});

describe("future appointment check", () => {
  const today = "2026-09-23";

  it("treats a later or still-open visit as a future appointment", () => {
    assert.equal(
      isOpenFutureAppointment(future(), today, "apt-1"),
      true,
    );
    assert.equal(
      isOpenFutureAppointment(
        future({ status: "pending_confirmation", appointmentDate: "2026-10-01" }),
        today,
        "apt-1",
      ),
      true,
    );
    assert.equal(
      isOpenFutureAppointment(
        future({ appointmentDate: today, serviceEndedAt: null }),
        today,
        "apt-1",
      ),
      true,
    );
  });

  it("ignores cancelled, finished, past, and the completed visit itself", () => {
    assert.equal(
      isOpenFutureAppointment(future({ status: "cancelled" }), today, "apt-1"),
      false,
    );
    assert.equal(
      isOpenFutureAppointment(
        future({
          appointmentDate: today,
          serviceEndedAt: "2026-09-23T15:00:00.000Z",
        }),
        today,
        "apt-1",
      ),
      false,
    );
    assert.equal(
      isOpenFutureAppointment(
        future({ appointmentDate: "2026-09-22" }),
        today,
        "apt-1",
      ),
      false,
    );
    assert.equal(
      isOpenFutureAppointment(future({ id: "apt-1" }), today, "apt-1"),
      false,
    );
    assert.equal(
      hasOpenFutureAppointment([future({ id: "apt-1" })], today, "apt-1"),
      false,
    );
  });
});

describe("rebook reminder job", () => {
  it("sends once when both future-appointment checks are clear", async () => {
    const { deps, calls, sent } = harness({ futureChecks: [[], []] });
    const result = await runRebookReminderJob(deps);

    assert.deepEqual(result, { sent: 1, skipped: 0, failed: 0 });
    assert.deepEqual(
      calls.filter((call) => !call.startsWith("sent:")),
      ["load", "future", "claim", "future", "send"],
    );
    assert.equal(calls.filter((call) => call.startsWith("sent:")).length, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.to, "sarah@example.com");
    assert.equal(sent[0]?.subject, "Time for Lychee’s next spa visit?");
    assert.match(sent[0]?.html ?? "", /BOOK NEXT APPOINTMENT/);
    assert.match(sent[0]?.html ?? "", /https:\/\/k9atelier\.com\/book/);
  });

  it("does not send when the client already has a future appointment", async () => {
    const { deps, calls } = harness({ futureChecks: [[future()]] });
    const result = await runRebookReminderJob(deps);

    assert.deepEqual(result, { sent: 0, skipped: 1, failed: 0 });
    assert.deepEqual(calls, ["load", "future", "skip"]);
  });

  it("checks again immediately before sending and skips if a visit appears", async () => {
    const { deps, calls, sent } = harness({
      futureChecks: [[], [future()]],
    });
    const result = await runRebookReminderJob(deps);

    assert.deepEqual(result, { sent: 0, skipped: 1, failed: 0 });
    assert.deepEqual(calls, ["load", "future", "claim", "future", "skip"]);
    assert.equal(sent.length, 0);
  });

  it("does not send a reminder that was already recorded", async () => {
    const { deps, calls } = harness({
      due: [candidate({ reminderStatus: "sent" })],
    });
    const result = await runRebookReminderJob(deps);

    assert.deepEqual(result, { sent: 0, skipped: 0, failed: 0 });
    assert.deepEqual(calls, ["load"]);
  });

  it("releases the claim when the email provider declines the send", async () => {
    const { deps, calls } = harness({
      futureChecks: [[], []],
      send: false,
    });
    const result = await runRebookReminderJob(deps);

    assert.deepEqual(result, { sent: 0, skipped: 0, failed: 1 });
    assert.deepEqual(calls, [
      "load",
      "future",
      "claim",
      "future",
      "send",
      "release",
    ]);
  });

  it("sends one reminder per completed appointment", async () => {
    const { deps, sent } = harness({
      due: [
        candidate(),
        candidate({
          id: "apt-2",
          petName: "Otto",
          serviceEndedAt: "2026-09-02T18:00:00.000Z",
        }),
      ],
      futureChecks: [[], [], [], []],
    });
    const result = await runRebookReminderJob(deps);

    assert.equal(result.sent, 2);
    assert.deepEqual(
      sent.map((message) => message.subject),
      [
        "Time for Lychee’s next spa visit?",
        "Time for Otto’s next spa visit?",
      ],
    );
  });

  it("stays quiet outside the 10am window and when email is not configured", async () => {
    const early = harness({ now: new Date("2026-09-23T13:00:00.000Z") });
    assert.equal(
      (await runRebookReminderJob(early.deps)).reason,
      "outside_10am_window",
    );
    assert.deepEqual(early.calls, []);

    const unconfigured = harness({ emailConfigured: false });
    assert.equal(
      (await runRebookReminderJob(unconfigured.deps)).reason,
      "email_not_configured",
    );
    assert.deepEqual(unconfigured.calls, []);
  });
});

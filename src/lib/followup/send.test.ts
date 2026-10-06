import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  followUpLeaseBefore,
  isFreshFollowUpClaim,
  selectClaimableIds,
  type FollowUpChannel,
} from "./claim";
import {
  deliverHouseholdFollowUps,
  type FollowUpClaimResult,
  type FollowUpStore,
} from "./deliver";
import type { FollowUpCharge, FollowUpPet } from "./eligibility";
import { normalizePhoneToE164 } from "@/lib/sms/phone";

const AT_1030 = new Date("2026-08-23T14:30:00.000Z");
const AT_0930 = new Date("2026-08-23T13:30:00.000Z");
const AT_1130 = new Date("2026-08-23T15:30:00.000Z");
const FOUR_DAYS_LATER = new Date("2026-08-26T14:30:00.000Z");

function pet(overrides: Partial<FollowUpPet> & Pick<FollowUpPet, "id" | "petName">): FollowUpPet {
  return {
    customerId: "jane",
    customerFirstName: "Jane",
    customerLastName: "Doe",
    customerEmail: "jane@example.com",
    customerPhone: "5615550100",
    appointmentDate: "2026-08-22",
    addressStreet: "10 Palm Street",
    addressCity: "Palm Beach Gardens",
    addressState: "FL",
    addressZip: "33418",
    status: "confirmed",
    serviceEndedAt: "2026-08-22T18:00:00.000Z",
    followupEmailSentAt: null,
    followupSmsSentAt: null,
    followupEmailClaimedAt: null,
    followupSmsClaimedAt: null,
    ...overrides,
  };
}

function serviceCharge(
  appointmentId: string,
  overrides: Partial<FollowUpCharge> = {},
): FollowUpCharge {
  return {
    appointmentId,
    kind: "service",
    status: "paid",
    total: 140,
    refundedAmount: 0,
    ...overrides,
  };
}

function createMemoryStore(pets: FollowUpPet[], charges: FollowUpCharge[]) {
  const rows = new Map(pets.map((row) => [row.id, { ...row }]));
  let chain = Promise.resolve();
  const lock = <T>(fn: () => T) => {
    const run = chain.then(() => fn());
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const sentKey = (channel: FollowUpChannel) =>
    channel === "email"
      ? ("followupEmailSentAt" as const)
      : ("followupSmsSentAt" as const);
  const claimKey = (channel: FollowUpChannel) =>
    channel === "email"
      ? ("followupEmailClaimedAt" as const)
      : ("followupSmsClaimedAt" as const);

  const store: FollowUpStore = {
    async listCompletedInWindow(start, end) {
      return [...rows.values()].filter(
        (row) =>
          Boolean(row.serviceEndedAt) &&
          row.appointmentDate >= start &&
          row.appointmentDate <= end,
      );
    },
    async listCharges(appointmentIds) {
      const ids = new Set(appointmentIds);
      return charges.filter((charge) => ids.has(charge.appointmentId));
    },
    async claimChannel(ids, channel, now) {
      return lock(() => {
        const sent = sentKey(channel);
        const claim = claimKey(channel);
        const snapshots = ids.map((id) => {
          const row = rows.get(id);
          return {
            id,
            sentAt: row?.[sent] ?? null,
            claimedAt: row?.[claim] ?? null,
          };
        });
        if (snapshots.some((row) => row.sentAt)) {
          const sentAt =
            snapshots.find((row) => row.sentAt)?.sentAt ?? now.toISOString();
          const leaseBefore = followUpLeaseBefore(now);
          for (const id of ids) {
            const row = rows.get(id);
            if (!row || row[sent]) continue;
            if (isFreshFollowUpClaim(row[claim], leaseBefore)) continue;
            row[sent] = sentAt;
            row[claim] = null;
          }
          return { status: "already_sent" } satisfies FollowUpClaimResult;
        }
        const claimable = selectClaimableIds(
          snapshots,
          ids,
          followUpLeaseBefore(now),
        );
        if (claimable.length !== ids.length) {
          return { status: "busy" } satisfies FollowUpClaimResult;
        }
        const claimAt = now.toISOString();
        for (const id of claimable) {
          const row = rows.get(id);
          if (row) row[claim] = claimAt;
        }
        return { status: "claimed", claimAt } satisfies FollowUpClaimResult;
      });
    },
    async markChannelSent(ids, channel, sentAt, claimAt) {
      return lock(() => {
        const sent = sentKey(channel);
        const claim = claimKey(channel);
        let marked = 0;
        for (const id of ids) {
          const row = rows.get(id);
          if (!row || row[claim] !== claimAt || row[sent]) continue;
          row[sent] = sentAt;
          row[claim] = null;
          marked += 1;
        }
        return marked > 0;
      });
    },
    async releaseClaim(ids, channel, claimAt) {
      await lock(() => {
        const sent = sentKey(channel);
        const claim = claimKey(channel);
        for (const id of ids) {
          const row = rows.get(id);
          if (!row || row[claim] !== claimAt || row[sent]) continue;
          row[claim] = null;
        }
      });
    },
  };

  return { store, rows };
}

function harness(
  pets: FollowUpPet[],
  charges: FollowUpCharge[],
  options: {
    emailSucceeds?: boolean | (() => boolean);
    smsSucceeds?: boolean | (() => boolean);
  } = {},
) {
  const memory = createMemoryStore(pets, charges);
  const emails: string[] = [];
  const sms: string[] = [];
  const logged: string[] = [];
  const succeed = (value: boolean | (() => boolean) | undefined) => {
    if (typeof value === "function") return value();
    return value !== false;
  };
  const deps = {
    store: memory.store,
    isEmailConfigured: true,
    isSmsConfigured: true,
    normalizePhone: normalizePhoneToE164,
    sendEmail: async (input: { subject: string; text: string }) => {
      emails.push(`${input.subject}\n${input.text}`);
      return succeed(options.emailSucceeds);
    },
    sendSms: async (input: { body: string }) => {
      sms.push(input.body);
      return succeed(options.smsSucceeds);
    },
    recordSms: async (input: { body: string }) => {
      logged.push(input.body);
    },
  };
  return { ...memory, emails, sms, logged, deps };
}

async function deliver(
  setup: ReturnType<typeof harness>,
  now = AT_1030,
) {
  return deliverHouseholdFollowUps({ ...setup.deps, now });
}

describe("household review follow-up delivery", () => {
  it("sends one email and one SMS for a completed single-dog visit", async () => {
    const setup = harness(
      [pet({ id: "daisy", petName: "Daisy" })],
      [serviceCharge("daisy")],
    );
    const result = await deliver(setup);
    assert.equal(result.sent, 1);
    assert.equal(setup.emails.length, 1);
    assert.equal(setup.sms.length, 1);
    assert.equal(setup.logged.length, 1);
    assert.match(setup.emails[0] ?? "", /Daisy/);
    assert.match(setup.sms[0] ?? "", /Daisy/);
    assert.equal(setup.rows.get("daisy")?.followupEmailSentAt == null, false);
    assert.equal(setup.rows.get("daisy")?.followupSmsSentAt == null, false);
  });

  it("sends one follow-up for two dogs on the same visit", async () => {
    const setup = harness(
      [
        pet({ id: "daisy", petName: "Daisy" }),
        pet({ id: "milo", petName: "Milo", addressStreet: "10 Palm St" }),
      ],
      [serviceCharge("daisy"), serviceCharge("milo")],
    );
    await deliver(setup);
    assert.equal(setup.emails.length, 1);
    assert.equal(setup.sms.length, 1);
    assert.match(setup.emails[0] ?? "", /Daisy and Milo/);
    assert.match(setup.sms[0] ?? "", /Daisy and Milo/);
    assert.equal(setup.rows.get("daisy")?.followupEmailSentAt == null, false);
    assert.equal(setup.rows.get("milo")?.followupSmsSentAt == null, false);
  });

  it("sends separate follow-ups for two visits", async () => {
    const setup = harness(
      [
        pet({ id: "daisy", petName: "Daisy" }),
        pet({
          id: "otto",
          petName: "Otto",
          addressStreet: "88 Lake Drive",
          addressZip: "33410",
        }),
      ],
      [serviceCharge("daisy"), serviceCharge("otto")],
    );
    await deliver(setup);
    assert.equal(setup.emails.length, 2);
    assert.equal(setup.sms.length, 2);
  });

  it("does not follow up a cancelled appointment", async () => {
    const setup = harness(
      [pet({ id: "daisy", petName: "Daisy", status: "cancelled" })],
      [serviceCharge("daisy")],
    );
    const result = await deliver(setup);
    assert.equal(setup.emails.length, 0);
    assert.equal(setup.sms.length, 0);
    assert.equal(result.sent, 0);
  });

  it("still follows up the completed dog when a sibling was cancelled", async () => {
    const setup = harness(
      [
        pet({ id: "daisy", petName: "Daisy" }),
        pet({ id: "milo", petName: "Milo", status: "cancelled" }),
      ],
      [serviceCharge("daisy"), serviceCharge("milo")],
    );
    await deliver(setup);
    assert.equal(setup.emails.length, 1);
    assert.match(setup.emails[0] ?? "", /Daisy/);
    assert.equal((setup.emails[0] ?? "").includes("Milo"), false);
  });

  it("does not request a review for a no-show", async () => {
    const setup = harness(
      [pet({ id: "daisy", petName: "Daisy" })],
      [
        serviceCharge("daisy", {
          kind: "no_show",
          total: 70,
        }),
      ],
    );
    await deliver(setup);
    assert.equal(setup.emails.length, 0);
    assert.equal(setup.sms.length, 0);
  });

  it("does not request a review when the service charge was fully refunded", async () => {
    const setup = harness(
      [pet({ id: "daisy", petName: "Daisy" })],
      [serviceCharge("daisy", { refundedAmount: 140 })],
    );
    await deliver(setup);
    assert.equal(setup.emails.length, 0);
    assert.equal(setup.sms.length, 0);
  });

  it("keeps email sent and retries only SMS after an SMS failure", async () => {
    let smsAttempts = 0;
    const setup = harness(
      [pet({ id: "daisy", petName: "Daisy" })],
      [serviceCharge("daisy")],
      {
        smsSucceeds: () => {
          smsAttempts += 1;
          return smsAttempts > 1;
        },
      },
    );
    await deliver(setup);
    assert.equal(setup.emails.length, 1);
    assert.equal(setup.sms.length, 1);
    assert.equal(setup.rows.get("daisy")?.followupEmailSentAt == null, false);
    assert.equal(setup.rows.get("daisy")?.followupSmsSentAt, null);

    await deliver(setup);
    assert.equal(setup.emails.length, 1);
    assert.equal(setup.sms.length, 2);
    assert.equal(setup.rows.get("daisy")?.followupSmsSentAt == null, false);
  });

  it("keeps SMS sent and retries only email after an email failure", async () => {
    let emailAttempts = 0;
    const setup = harness(
      [pet({ id: "daisy", petName: "Daisy" })],
      [serviceCharge("daisy")],
      {
        emailSucceeds: () => {
          emailAttempts += 1;
          return emailAttempts > 1;
        },
      },
    );
    await deliver(setup);
    assert.equal(setup.emails.length, 1);
    assert.equal(setup.sms.length, 1);
    assert.equal(setup.rows.get("daisy")?.followupEmailSentAt, null);
    assert.equal(setup.rows.get("daisy")?.followupSmsSentAt == null, false);

    await deliver(setup);
    assert.equal(setup.emails.length, 2);
    assert.equal(setup.sms.length, 1);
    assert.equal(setup.rows.get("daisy")?.followupEmailSentAt == null, false);
  });

  it("does not double-send when two cron runs overlap", async () => {
    const setup = harness(
      [pet({ id: "daisy", petName: "Daisy" })],
      [serviceCharge("daisy")],
    );
    const originalSendEmail = setup.deps.sendEmail;
    setup.deps.sendEmail = async (input) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return originalSendEmail(input);
    };
    await Promise.all([deliver(setup), deliver(setup)]);
    assert.equal(setup.emails.length, 1);
    assert.equal(setup.sms.length, 1);
  });

  it("still sends after the original 10:00 run was missed", async () => {
    const setup = harness(
      [pet({ id: "daisy", petName: "Daisy" })],
      [serviceCharge("daisy")],
    );
    const tooEarly = await deliver(setup, AT_0930);
    assert.equal(tooEarly.reason, "outside_followup_window");
    assert.equal(setup.emails.length, 0);

    const lateSameDay = await deliver(setup, AT_1130);
    assert.equal(lateSameDay.sent, 1);
    assert.equal(setup.emails.length, 1);
    assert.equal(setup.sms.length, 1);
  });

  it("stops retrying after the three-day window", async () => {
    const setup = harness(
      [pet({ id: "daisy", petName: "Daisy" })],
      [serviceCharge("daisy")],
    );
    const result = await deliver(setup, FOUR_DAYS_LATER);
    assert.equal(result.sent, 0);
    assert.equal(setup.emails.length, 0);
    assert.equal(setup.sms.length, 0);
  });
});

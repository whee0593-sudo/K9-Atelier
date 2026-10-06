import type { FollowUpChannel } from "@/lib/followup/claim";
import {
  buildNextDayFollowUpEmail,
  buildNextDayFollowUpSms,
} from "@/lib/followup/copy";
import {
  eligibleVisitPets,
  followUpServiceDateWindow,
  groupHouseholdVisits,
  isFollowUpSendHour,
  type FollowUpCharge,
  type FollowUpPet,
} from "@/lib/followup/eligibility";

export type FollowUpRunResult = {
  sent: number;
  skipped: number;
  failed: number;
  reason?: string;
};

export type FollowUpClaimResult =
  | { status: "claimed"; claimAt: string }
  | { status: "busy" }
  | { status: "already_sent" };

export type FollowUpStore = {
  listCompletedInWindow(
    start: string,
    end: string,
  ): Promise<FollowUpPet[] | null>;
  listCharges(appointmentIds: string[]): Promise<FollowUpCharge[] | null>;
  claimChannel(
    ids: string[],
    channel: FollowUpChannel,
    now: Date,
  ): Promise<FollowUpClaimResult>;
  markChannelSent(
    ids: string[],
    channel: FollowUpChannel,
    sentAt: string,
    claimAt: string,
  ): Promise<boolean>;
  releaseClaim(
    ids: string[],
    channel: FollowUpChannel,
    claimAt: string,
  ): Promise<void>;
};

export type FollowUpDeliveryDeps = {
  now: Date;
  store: FollowUpStore;
  isEmailConfigured: boolean;
  isSmsConfigured: boolean;
  sendEmail: (input: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) => Promise<boolean>;
  sendSms: (input: { to: string; body: string }) => Promise<boolean>;
  recordSms: (input: {
    phone: string;
    body: string;
    customerId: string;
    customerName: string | null;
    petNames: string[];
  }) => Promise<void>;
  normalizePhone: (phone: string) => string | null;
};

export async function deliverHouseholdFollowUps(
  deps: FollowUpDeliveryDeps,
): Promise<FollowUpRunResult> {
  if (!isFollowUpSendHour(deps.now)) {
    return { sent: 0, skipped: 0, failed: 0, reason: "outside_followup_window" };
  }
  if (!deps.isEmailConfigured && !deps.isSmsConfigured) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      reason: "notifications_not_configured",
    };
  }

  const window = followUpServiceDateWindow(deps.now);
  const pets = await deps.store.listCompletedInWindow(window.start, window.end);
  if (!pets) return { sent: 0, skipped: 0, failed: 0, reason: "lookup_failed" };
  if (pets.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const charges = await deps.store.listCharges(pets.map((pet) => pet.id));
  if (!charges) return { sent: 0, skipped: 0, failed: 0, reason: "lookup_failed" };

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const group of groupHouseholdVisits(pets).values()) {
    const eligible = eligibleVisitPets(group, charges);
    if (eligible.length === 0) {
      skipped += 1;
      continue;
    }

    const ids = group.map((pet) => pet.id);
    const names = {
      firstName: eligible.find((pet) => pet.customerFirstName)?.customerFirstName,
      petNames: eligible.map((pet) => pet.petName),
    };
    const email = eligible
      .map((pet) => pet.customerEmail.trim())
      .find(Boolean);
    const phone = eligible
      .map((pet) => deps.normalizePhone(pet.customerPhone ?? ""))
      .find((value): value is string => Boolean(value));
    const customer =
      eligible.find((pet) => pet.customerFirstName || pet.customerLastName) ??
      eligible[0];
    const customerName = [customer?.customerFirstName, customer?.customerLastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const emailResult = await deliverChannel({
      deps,
      ids,
      channel: "email",
      canSend: Boolean(email) && deps.isEmailConfigured,
      send: async () => {
        const letter = buildNextDayFollowUpEmail(names);
        return deps.sendEmail({
          to: email ?? "",
          subject: letter.subject,
          text: letter.text,
          html: letter.html,
        });
      },
    });
    const smsResult = await deliverChannel({
      deps,
      ids,
      channel: "sms",
      canSend: Boolean(phone) && deps.isSmsConfigured,
      send: async () => {
        const body = buildNextDayFollowUpSms(names);
        const delivered = await deps.sendSms({ to: phone ?? "", body });
        if (!delivered || !phone || !customer) return false;
        await deps.recordSms({
          phone,
          body,
          customerId: customer.customerId,
          customerName: customerName || null,
          petNames: eligible.map((pet) => pet.petName),
        });
        return true;
      },
    });

    if (emailResult === "sent" || smsResult === "sent") sent += 1;
    else if (emailResult === "failed" || smsResult === "failed") failed += 1;
    else skipped += 1;
  }

  return { sent, skipped, failed };
}

async function deliverChannel(input: {
  deps: FollowUpDeliveryDeps;
  ids: string[];
  channel: FollowUpChannel;
  canSend: boolean;
  send: () => Promise<boolean>;
}): Promise<"sent" | "failed" | "skipped" | "done"> {
  if (!input.canSend) return "skipped";

  const claim = await input.deps.store.claimChannel(
    input.ids,
    input.channel,
    input.deps.now,
  );
  if (claim.status === "already_sent" || claim.status === "busy") return "done";

  let delivered = false;
  try {
    delivered = await input.send();
  } catch (error) {
    console.error(`next-day follow-up ${input.channel} failed:`, error);
    delivered = false;
  }

  if (!delivered) {
    await input.deps.store.releaseClaim(
      input.ids,
      input.channel,
      claim.claimAt,
    );
    return "failed";
  }

  const marked = await input.deps.store.markChannelSent(
    input.ids,
    input.channel,
    new Date().toISOString(),
    claim.claimAt,
  );
  if (!marked) {
    console.error(
      `next-day follow-up ${input.channel} sent but was not marked`,
      input.ids,
    );
  }
  return "sent";
}

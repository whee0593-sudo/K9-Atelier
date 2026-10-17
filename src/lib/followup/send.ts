import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { deliverTrackedNotice, type DeliveryOutcome } from "@/lib/communications/deliver";
import {
  communicationAppointmentScope,
  communicationIdempotencyKey,
  communicationVisitScope,
} from "@/lib/communications/keys";
import { sendTrackedEmail, sendTrackedSms } from "@/lib/communications/provider";
import { createSupabaseClaimStore } from "@/lib/communications/supabase-store";
import type { CommunicationClaimStore } from "@/lib/communications/store";
import type { ProviderAttempt } from "@/lib/communications/types";
import {
  joinPetNames,
  planNextDayFollowUp,
  type VisitDogFact,
} from "@/lib/communications/visit-readiness";
import {
  buildNextDayFollowUpEmail,
  buildNextDayFollowUpSms,
} from "@/lib/followup/copy";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  addDaysToIsoDate,
  businessDayUtcRange,
  hourInBusinessTimezone,
  todayInBusinessTimezone,
} from "@/lib/sms/schedule";
import { isEmailConfigured } from "@/lib/email/resend";
import { isSmsConfigured } from "@/lib/sms/twilio";

const FOLLOW_UP_LOOKBACK_DAYS = 21;

export type FollowUpDog = VisitDogFact & {
  visitId: string | null;
  scope: string;
  customerId: string;
  customerEmail: string;
  customerPhone: string | null;
  customerFirstName: string | null;
  petName: string | null;
};

export type FollowUpRunResult = {
  sent: number;
  skipped: number;
  failed: number;
  reason?: string;
};

export type FollowUpJobDeps = {
  now: Date;
  emailConfigured: boolean;
  smsConfigured: boolean;
  loadVisits: () => Promise<FollowUpDog[][] | null>;
  deliver: (input: {
    visitId: string | null;
    scope: string;
    channel: "email" | "sms";
    dogs: FollowUpDog[];
    recipient: string;
    subject: string | null;
    bodyText: string;
    bodyHtml: string | null;
  }) => Promise<DeliveryOutcome>;
  markSent: (appointmentIds: string[], sentAt: string) => Promise<boolean>;
};

function terminal(outcome: DeliveryOutcome) {
  return (
    outcome === "accepted" ||
    outcome === "duplicate" ||
    outcome === "held" ||
    outcome === "uncertain" ||
    outcome === "skipped"
  );
}

export async function runNextDayFollowUpJob(
  deps: FollowUpJobDeps,
): Promise<FollowUpRunResult> {
  if (hourInBusinessTimezone(deps.now) !== 10) {
    return { sent: 0, skipped: 0, failed: 0, reason: "outside_10am_window" };
  }
  if (!deps.emailConfigured && !deps.smsConfigured) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      reason: "notifications_not_configured",
    };
  }

  const visits = await deps.loadVisits();
  if (!visits) return { sent: 0, skipped: 0, failed: 0, reason: "lookup_failed" };

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const dogs of visits) {
    const plan = planNextDayFollowUp({ dogs, now: deps.now });
    if (plan.action === "already_sent") {
      const unmarked = dogs.filter((dog) => !dog.followupSentAt);
      if (unmarked.length > 0) {
        const marked = await deps.markSent(
          unmarked.map((dog) => dog.appointmentId),
          new Date().toISOString(),
        );
        if (!marked) failed += 1;
        else skipped += 1;
      } else {
        skipped += 1;
      }
      continue;
    }
    if (plan.action !== "send") {
      skipped += 1;
      continue;
    }

    const anchor = dogs.find((dog) => dog.status !== "cancelled") ?? dogs[0];
    if (!anchor) {
      skipped += 1;
      continue;
    }
    const names = {
      firstName: anchor.customerFirstName,
      petName: joinPetNames(
        dogs.filter((dog) => dog.status !== "cancelled").map((dog) => dog.petName),
      ),
    };
    const email = anchor.customerEmail.trim();
    const phone = normalizePhoneToE164(anchor.customerPhone ?? "");
    const canEmail = Boolean(email) && deps.emailConfigured;
    const canSms = Boolean(phone) && deps.smsConfigured;
    if (!canEmail && !canSms) {
      skipped += 1;
      continue;
    }

    const outcomes: DeliveryOutcome[] = [];
    if (canEmail) {
      const letter = buildNextDayFollowUpEmail(names);
      outcomes.push(
        await deps.deliver({
          visitId: anchor.visitId,
          scope: anchor.scope,
          channel: "email",
          dogs,
          recipient: email,
          subject: letter.subject,
          bodyText: letter.text,
          bodyHtml: letter.html,
        }),
      );
    }
    if (canSms && phone) {
      outcomes.push(
        await deps.deliver({
          visitId: anchor.visitId,
          scope: anchor.scope,
          channel: "sms",
          dogs,
          recipient: phone,
          subject: null,
          bodyText: buildNextDayFollowUpSms(names),
          bodyHtml: null,
        }),
      );
    }

    const retryable = outcomes.some(
      (outcome) => outcome === "failed" || outcome === "unrecorded",
    );
    const accepted = outcomes.some(
      (outcome) => outcome === "accepted" || outcome === "duplicate",
    );
    if (retryable || !accepted) {
      failed += 1;
      continue;
    }
    if (!outcomes.every(terminal)) {
      failed += 1;
      continue;
    }
    const marked = await deps.markSent(plan.appointmentIds, new Date().toISOString());
    if (!marked) {
      failed += 1;
      continue;
    }
    sent += 1;
  }

  return { sent, skipped, failed };
}

type FollowUpRow = {
  id: string;
  customer_id: string;
  visit_id: string | null;
  pet_id: string;
  status: string;
  service_ended_at: string | null;
  followup_sent_at: string | null;
  pets?: { name: string | null } | { name: string | null }[] | null;
  profiles?:
    | {
        email: string | null;
        first_name: string | null;
        phone: string | null;
      }
    | {
        email: string | null;
        first_name: string | null;
        phone: string | null;
      }[]
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapDog(row: FollowUpRow): FollowUpDog {
  const profile = firstRelation(row.profiles);
  const pet = firstRelation(row.pets);
  const visitId = row.visit_id?.trim() || null;
  return {
    appointmentId: row.id,
    visitId,
    scope: visitId
      ? communicationVisitScope(visitId)
      : communicationAppointmentScope(row.id),
    status: row.status,
    serviceEndedAt: row.service_ended_at,
    followupSentAt: row.followup_sent_at,
    petName: pet?.name ?? null,
    customerId: row.customer_id,
    customerEmail: profile?.email ?? "",
    customerPhone: profile?.phone ?? null,
    customerFirstName: profile?.first_name ?? null,
  };
}

const DOG_SELECT = `
  id,
  customer_id,
  visit_id,
  pet_id,
  status,
  service_ended_at,
  followup_sent_at,
  pets ( name ),
  profiles ( email, first_name, phone )
`;

export async function sendNextDayFollowUp(
  now = new Date(),
): Promise<FollowUpRunResult> {
  const canQuery =
    hourInBusinessTimezone(now) === 10 &&
    (isEmailConfigured() || isSmsConfigured()) &&
    hasSupabaseAdminConfig();
  const admin = canQuery ? createAdminClient() : null;
  const store: CommunicationClaimStore | null = admin
    ? createSupabaseClaimStore(admin)
    : null;

  return runNextDayFollowUpJob({
    now,
    emailConfigured: isEmailConfigured(),
    smsConfigured: isSmsConfigured(),
    loadVisits: async () => {
      if (!admin) return null;
      const today = todayInBusinessTimezone(now);
      const earliest = addDaysToIsoDate(today, -FOLLOW_UP_LOOKBACK_DAYS);
      const { data, error } = await admin
        .from("appointments")
        .select("id, visit_id, service_ended_at, followup_sent_at, status")
        .neq("status", "cancelled")
        .is("followup_sent_at", null)
        .not("service_ended_at", "is", null)
        .gte("service_ended_at", businessDayUtcRange(earliest).start);
      if (error) {
        console.error("sendNextDayFollowUp lookup failed:", error.message);
        return null;
      }
      const seeds = (data ?? []) as Array<{ id: string; visit_id?: string | null }>;
      const visitIds = [
        ...new Set(
          seeds
            .map((row) => row.visit_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const orphanIds = seeds.filter((row) => !row.visit_id).map((row) => row.id);
      const visits: FollowUpDog[][] = [];
      for (const visitId of visitIds) {
        const loaded = await admin
          .from("appointments")
          .select(DOG_SELECT)
          .eq("visit_id", visitId)
          .neq("status", "cancelled");
        if (loaded.error) {
          console.error(
            "sendNextDayFollowUp visit lookup failed:",
            visitId,
            loaded.error.message,
          );
          return null;
        }
        const dogs = ((loaded.data ?? []) as unknown as FollowUpRow[]).map(mapDog);
        if (dogs.length > 0) visits.push(dogs);
      }
      if (orphanIds.length > 0) {
        const loaded = await admin
          .from("appointments")
          .select(DOG_SELECT)
          .in("id", orphanIds)
          .neq("status", "cancelled");
        if (loaded.error) {
          console.error("sendNextDayFollowUp appointment lookup failed:", loaded.error.message);
          return null;
        }
        for (const row of (loaded.data ?? []) as unknown as FollowUpRow[]) {
          visits.push([mapDog(row)]);
        }
      }
      return visits;
    },
    deliver: async (input) => {
      if (!store) return "unrecorded";
      const active = input.dogs.filter((dog) => dog.status !== "cancelled");
      const snapshotBase = {
        notificationType: "next_day_followup",
        audience: "customer" as const,
        customerId: active[0]?.customerId ?? null,
        visitId: input.visitId,
        appointmentIds: active.map((dog) => dog.appointmentId),
        petIds: [],
        recipient: input.recipient,
        subject: input.subject,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
        replyTo: null,
        idempotencyKey: communicationIdempotencyKey({
          channel: input.channel,
          notificationType: "next_day_followup",
          audience: "customer",
          scope: input.scope,
          fingerprint: "-",
        }),
      };
      return deliverTrackedNotice({
        store,
        snapshot:
          input.channel === "email"
            ? { ...snapshotBase, channel: "email", provider: "resend" }
            : { ...snapshotBase, channel: "sms", provider: "twilio" },
        send: async () => {
          const result =
            input.channel === "email"
              ? await sendTrackedEmail({
                  to: input.recipient,
                  subject: input.subject ?? "Checking in",
                  text: input.bodyText,
                  html: input.bodyHtml,
                })
              : await sendTrackedSms({ to: input.recipient, body: input.bodyText });
          if (result.outcome === "skipped") {
            return { outcome: "failed", error: "missing_config" } satisfies ProviderAttempt;
          }
          if (result.outcome === "accepted" && input.channel === "sms") {
            await recordCustomerSms({
              direction: "outbound",
              phone: input.recipient,
              body: input.bodyText,
              customerId: active[0]?.customerId ?? null,
              customerName: active[0]?.customerFirstName ?? null,
              petNames: active.map((dog) => dog.petName ?? "").filter(Boolean),
            });
          }
          return result;
        },
      });
    },
    markSent: async (appointmentIds, sentAt) => {
      if (!admin || appointmentIds.length === 0) return false;
      const { error } = await admin
        .from("appointments")
        .update({ followup_sent_at: sentAt })
        .in("id", appointmentIds);
      if (error) {
        console.error("sendNextDayFollowUp mark failed:", error.message);
        return false;
      }
      return true;
    },
  });
}

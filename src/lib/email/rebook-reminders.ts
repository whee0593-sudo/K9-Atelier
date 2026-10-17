import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import {
  buildRebookReminderEmail,
} from "@/lib/email/rebook-reminder";
import { isEmailConfigured } from "@/lib/email/resend";
import { deliverTrackedNotice } from "@/lib/communications/deliver";
import {
  communicationIdempotencyKey,
  communicationVisitScope,
} from "@/lib/communications/keys";
import { sendTrackedEmail } from "@/lib/communications/provider";
import { createSupabaseClaimStore } from "@/lib/communications/supabase-store";
import { planRebookReminder } from "@/lib/communications/visit-readiness";
import {
  addDaysToIsoDate,
  businessDayUtcRange,
  calendarDateInBusinessTimezone,
  hourInBusinessTimezone,
  todayInBusinessTimezone,
} from "@/lib/sms/schedule";

/** Days after the completion date before the rebooking reminder is due. */
export const REBOOK_REMINDER_DAYS = 21;

/**
 * Extra day so a missed 10am cron still sends once.
 * Appointments older than this are left alone.
 */
export const REBOOK_REMINDER_CATCHUP_DAYS = 1;

export type RebookReminderRunResult = {
  sent: number;
  skipped: number;
  failed: number;
  reason?: string;
};

export type RebookReminderCandidate = {
  id: string;
  visitId?: string | null;
  customerId: string;
  appointmentStatus: string;
  serviceEndedAt: string | null;
  reminderStatus: string | null;
  petName: string | null;
  customerEmail: string | null;
  customerFirstName: string | null;
};

export type RebookVisitDog = {
  id: string;
  status: string;
  serviceEndedAt: string | null;
  reminderStatus: string | null;
  petName: string | null;
};

export type FutureAppointmentSnapshot = {
  id: string;
  status: string;
  appointmentDate: string;
  serviceEndedAt: string | null;
};

type DueRow = {
  id: string;
  visit_id?: string | null;
  customer_id: string;
  status: string;
  service_ended_at: string | null;
  rebook_reminder_status: string | null;
  pets?: { name: string | null } | { name: string | null }[] | null;
  profiles?:
    | { email: string | null; first_name: string | null }
    | { email: string | null; first_name: string | null }[]
    | null;
};

const DUE_SELECT = `
  id,
  visit_id,
  customer_id,
  status,
  service_ended_at,
  rebook_reminder_status,
  pets ( name ),
  profiles ( email, first_name )
`;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function rebookReminderLookupRange(today: string) {
  const earliestCompletion = addDaysToIsoDate(
    today,
    -(REBOOK_REMINDER_DAYS + REBOOK_REMINDER_CATCHUP_DAYS),
  );
  const dayAfterLatestCompletion = addDaysToIsoDate(
    today,
    -(REBOOK_REMINDER_DAYS - 1),
  );
  return {
    start: businessDayUtcRange(earliestCompletion).start,
    end: businessDayUtcRange(dayAfterLatestCompletion).start,
  };
}

export function isRebookReminderDue(
  candidate: Pick<
    RebookReminderCandidate,
    "appointmentStatus" | "serviceEndedAt" | "reminderStatus"
  >,
  today: string,
) {
  if (candidate.appointmentStatus === "cancelled") return false;
  if (!candidate.serviceEndedAt) return false;
  if (candidate.reminderStatus) return false;
  const completedOn = calendarDateInBusinessTimezone(
    new Date(candidate.serviceEndedAt),
  );
  const dueOn = addDaysToIsoDate(completedOn, REBOOK_REMINDER_DAYS);
  if (dueOn > today) return false;
  const oldestDue = addDaysToIsoDate(today, -REBOOK_REMINDER_CATCHUP_DAYS);
  return dueOn >= oldestDue;
}

/** A non-cancelled appointment that is still ahead of the client. */
export function isOpenFutureAppointment(
  appointment: FutureAppointmentSnapshot,
  today: string,
  sourceAppointmentId: string,
) {
  if (appointment.id === sourceAppointmentId) return false;
  if (appointment.status === "cancelled") return false;
  if (appointment.appointmentDate > today) return true;
  return (
    appointment.appointmentDate === today && !appointment.serviceEndedAt
  );
}

export function hasOpenFutureAppointment(
  appointments: FutureAppointmentSnapshot[],
  today: string,
  sourceAppointmentId: string,
) {
  return appointments.some((appointment) =>
    isOpenFutureAppointment(appointment, today, sourceAppointmentId),
  );
}

export type RebookReminderJobDeps = {
  now: Date;
  isEmailConfigured: () => boolean;
  isStorageConfigured: () => boolean;
  loadDue: (
    range: { start: string; end: string },
  ) => Promise<RebookReminderCandidate[] | null>;
  loadFuture: (
    customerId: string,
    today: string,
  ) => Promise<FutureAppointmentSnapshot[] | null>;
  claim: (appointmentId: string) => Promise<boolean>;
  markSkipped: (appointmentId: string) => Promise<boolean>;
  markSent: (appointmentId: string, sentAt: string) => Promise<boolean>;
  release: (appointmentId: string) => Promise<void>;
  loadVisitDogs?: (visitId: string) => Promise<RebookVisitDog[] | null>;
  trackVisitSend?: (input: {
    visitId: string;
    customerId: string;
    appointmentIds: string[];
    message: { to: string; subject: string; text: string; html: string };
  }) => Promise<boolean | "uncertain">;
  send: (message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) => Promise<boolean | "uncertain">;
};

function emptyResult(reason: string): RebookReminderRunResult {
  return { sent: 0, skipped: 0, failed: 0, reason };
}

export async function runRebookReminderJob(
  deps: RebookReminderJobDeps,
): Promise<RebookReminderRunResult> {
  if (hourInBusinessTimezone(deps.now) !== 10) {
    return emptyResult("outside_10am_window");
  }
  if (!deps.isEmailConfigured()) {
    return emptyResult("email_not_configured");
  }
  if (!deps.isStorageConfigured()) {
    return emptyResult("supabase_admin_missing");
  }

  const today = todayInBusinessTimezone(deps.now);
  const due = await deps.loadDue(rebookReminderLookupRange(today));
  if (!due) return emptyResult("lookup_failed");

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const handledVisits = new Set<string>();

  for (const candidate of due) {
    if (candidate.visitId && deps.loadVisitDogs) {
      if (handledVisits.has(candidate.visitId)) continue;
      const visitResult = await runVisitRebookReminder(candidate, today, deps, handledVisits);
      sent += visitResult.sent;
      skipped += visitResult.skipped;
      failed += visitResult.failed;
      continue;
    }
    if (!isRebookReminderDue(candidate, today)) continue;
    if (!candidate.customerEmail?.trim()) {
      skipped += 1;
      continue;
    }

    const beforeSend = await deps.loadFuture(candidate.customerId, today);
    if (!beforeSend) {
      failed += 1;
      continue;
    }
    if (hasOpenFutureAppointment(beforeSend, today, candidate.id)) {
      const marked = await deps.markSkipped(candidate.id);
      if (marked) skipped += 1;
      else failed += 1;
      continue;
    }

    const claimed = await deps.claim(candidate.id);
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const immediatelyBeforeSend = await deps.loadFuture(
      candidate.customerId,
      today,
    );
    if (!immediatelyBeforeSend) {
      await deps.release(candidate.id);
      failed += 1;
      continue;
    }
    if (hasOpenFutureAppointment(immediatelyBeforeSend, today, candidate.id)) {
      const marked = await deps.markSkipped(candidate.id);
      if (marked) skipped += 1;
      else failed += 1;
      continue;
    }

    const email = buildRebookReminderEmail({
      firstName: candidate.customerFirstName,
      petName: candidate.petName,
    });
    const delivered = await sendRebookEmail(deps, candidate.id, {
      to: candidate.customerEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (delivered === "uncertain") {
      failed += 1;
      continue;
    }
    if (!delivered) {
      await deps.release(candidate.id);
      failed += 1;
      continue;
    }

    const marked = await deps.markSent(candidate.id, new Date().toISOString());
    if (!marked) {
      console.error(
        "rebook reminder was sent but the sent timestamp was not saved:",
        candidate.id,
      );
      failed += 1;
      continue;
    }
    sent += 1;
  }

  return { sent, skipped, failed };
}

async function sendRebookEmail(
  deps: RebookReminderJobDeps,
  appointmentId: string,
  message: { to: string; subject: string; text: string; html: string },
): Promise<boolean | "uncertain"> {
  try {
    return await deps.send(message);
  } catch (error) {
    console.error("rebook reminder send threw:", appointmentId, error);
    return "uncertain";
  }
}

async function runVisitRebookReminder(
  candidate: RebookReminderCandidate,
  today: string,
  deps: RebookReminderJobDeps,
  handledVisits: Set<string>,
): Promise<RebookReminderRunResult> {
  const visitId = candidate.visitId;
  if (!visitId || !deps.loadVisitDogs) {
    return { sent: 0, skipped: 0, failed: 0 };
  }
  const dogs = await deps.loadVisitDogs(visitId);
  if (!dogs) return { sent: 0, skipped: 0, failed: 1 };
  const beforeSend = await deps.loadFuture(candidate.customerId, today);
  if (!beforeSend) return { sent: 0, skipped: 0, failed: 1 };
  const plan = planRebookReminder({
    dogs: dogs.map((dog) => ({
      appointmentId: dog.id,
      status: dog.status,
      serviceEndedAt: dog.serviceEndedAt,
      reminderStatus: dog.reminderStatus,
      petName: dog.petName,
    })),
    now: deps.now,
    hasOpenFuture: hasOpenFutureAppointment(beforeSend, today, candidate.id),
  });
  if (plan.action === "already_sent") {
    handledVisits.add(visitId);
    for (const id of plan.appointmentIds) {
      const dog = dogs.find((row) => row.id === id);
      if (dog && !dog.reminderStatus) {
        const claimed = await deps.claim(id);
        if (claimed) {
          const marked = await deps.markSent(id, new Date().toISOString());
          if (!marked) return { sent: 0, skipped: 0, failed: 1 };
        }
      }
    }
    return { sent: 0, skipped: 1, failed: 0 };
  }
  if (plan.action === "already_skipped" || plan.action === "skip_future") {
    handledVisits.add(visitId);
    for (const id of plan.appointmentIds) {
      const dog = dogs.find((row) => row.id === id);
      if (dog && !dog.reminderStatus) {
        const marked = await deps.markSkipped(id);
        if (!marked) return { sent: 0, skipped: 0, failed: 1 };
      }
    }
    return { sent: 0, skipped: 1, failed: 0 };
  }
  if (plan.action !== "send") {
    return { sent: 0, skipped: 1, failed: 0 };
  }

  handledVisits.add(visitId);
  const claimed: string[] = [];
  for (const id of plan.appointmentIds) {
    const ok = await deps.claim(id);
    if (!ok) {
      for (const claimedId of claimed) await deps.release(claimedId);
      return { sent: 0, skipped: 1, failed: 0 };
    }
    claimed.push(id);
  }

  const immediatelyBeforeSend = await deps.loadFuture(candidate.customerId, today);
  if (!immediatelyBeforeSend) {
    for (const id of claimed) await deps.release(id);
    return { sent: 0, skipped: 0, failed: 1 };
  }
  if (hasOpenFutureAppointment(immediatelyBeforeSend, today, candidate.id)) {
    for (const id of claimed) {
      const marked = await deps.markSkipped(id);
      if (!marked) return { sent: 0, skipped: 0, failed: 1 };
    }
    return { sent: 0, skipped: 1, failed: 0 };
  }

  const emailAddress = candidate.customerEmail?.trim();
  if (!emailAddress) {
    for (const id of claimed) await deps.release(id);
    return { sent: 0, skipped: 1, failed: 0 };
  }
  const petName = dogs
    .filter((dog) => dog.status !== "cancelled")
    .map((dog) => dog.petName?.trim() ?? "")
    .filter(Boolean)
    .join(" and ");
  const email = buildRebookReminderEmail({
    firstName: candidate.customerFirstName,
    petName: petName || candidate.petName,
  });
  const message = {
    to: emailAddress,
    subject: email.subject,
    text: email.text,
    html: email.html,
  };
  let delivered: boolean | "uncertain";
  if (deps.trackVisitSend) {
    try {
      delivered = await deps.trackVisitSend({
        visitId,
        customerId: candidate.customerId,
        appointmentIds: plan.appointmentIds,
        message,
      });
    } catch (error) {
      console.error("rebook reminder send threw:", candidate.id, error);
      delivered = "uncertain";
    }
  } else {
    delivered = await sendRebookEmail(deps, candidate.id, message);
  }
  if (delivered === "uncertain") {
    return { sent: 0, skipped: 0, failed: 1 };
  }
  if (!delivered) {
    for (const id of claimed) await deps.release(id);
    return { sent: 0, skipped: 0, failed: 1 };
  }
  for (const id of claimed) {
    const marked = await deps.markSent(id, new Date().toISOString());
    if (!marked) return { sent: 0, skipped: 0, failed: 1 };
  }
  return { sent: 1, skipped: 0, failed: 0 };
}

function mapDueRow(row: DueRow): RebookReminderCandidate {
  const pet = firstRelation(row.pets);
  const profile = firstRelation(row.profiles);
  return {
    id: row.id,
    visitId: row.visit_id ?? null,
    customerId: row.customer_id,
    appointmentStatus: row.status,
    serviceEndedAt: row.service_ended_at,
    reminderStatus: row.rebook_reminder_status,
    petName: pet?.name ?? null,
    customerEmail: profile?.email ?? null,
    customerFirstName: profile?.first_name ?? null,
  };
}

export async function sendThreeWeekRebookReminders(
  now = new Date(),
): Promise<RebookReminderRunResult> {
  const canQuery =
    hourInBusinessTimezone(now) === 10 &&
    isEmailConfigured() &&
    hasSupabaseAdminConfig();
  const admin = canQuery ? createAdminClient() : null;

  return runRebookReminderJob({
    now,
    isEmailConfigured,
    isStorageConfigured: hasSupabaseAdminConfig,
    loadDue: async (range) => {
      const { data, error } = await admin!
        .from("appointments")
        .select(DUE_SELECT)
        .gte("service_ended_at", range.start)
        .lt("service_ended_at", range.end)
        .neq("status", "cancelled")
        .is("rebook_reminder_status", null);
      if (error) {
        console.error("rebook reminder lookup failed:", error.message);
        return null;
      }
      return ((data ?? []) as unknown as DueRow[]).map(mapDueRow);
    },
    loadVisitDogs: async (visitId) => {
      const { data, error } = await admin!
        .from("appointments")
        .select("id, status, service_ended_at, rebook_reminder_status, pets ( name )")
        .eq("visit_id", visitId);
      if (error) {
        console.error("rebook reminder visit lookup failed:", visitId, error.message);
        return null;
      }
      return (
        (data ?? []) as Array<{
          id: string;
          status: string;
          service_ended_at: string | null;
          rebook_reminder_status: string | null;
          pets?: { name: string | null } | { name: string | null }[] | null;
        }>
      ).map((row) => ({
        id: row.id,
        status: row.status,
        serviceEndedAt: row.service_ended_at,
        reminderStatus: row.rebook_reminder_status,
        petName: firstRelation(row.pets)?.name ?? null,
      }));
    },
    loadFuture: async (customerId, today) => {
      const { data, error } = await admin!
        .from("appointments")
        .select("id, status, appointment_date, service_ended_at")
        .eq("customer_id", customerId)
        .neq("status", "cancelled")
        .gte("appointment_date", today);
      if (error) {
        console.error("rebook reminder future lookup failed:", error.message);
        return null;
      }
      return (
        (data ?? []) as Array<{
          id: string;
          status: string;
          appointment_date: string;
          service_ended_at: string | null;
        }>
      ).map((row) => ({
        id: row.id,
        status: row.status,
        appointmentDate: row.appointment_date,
        serviceEndedAt: row.service_ended_at,
      }));
    },
    claim: async (appointmentId) => {
      const { data, error } = await admin!
        .from("appointments")
        .update({ rebook_reminder_status: "sending" })
        .eq("id", appointmentId)
        .is("rebook_reminder_status", null)
        .select("id");
      if (error) {
        console.error("rebook reminder claim failed:", appointmentId, error.message);
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    },
    markSkipped: async (appointmentId) => {
      const { data, error } = await admin!
        .from("appointments")
        .update({
          rebook_reminder_status: "skipped",
          rebook_reminder_sent_at: null,
        })
        .eq("id", appointmentId)
        .or("rebook_reminder_status.is.null,rebook_reminder_status.eq.sending")
        .select("id");
      if (error) {
        console.error(
          "rebook reminder skip mark failed:",
          appointmentId,
          error.message,
        );
        return false;
      }
      if (Array.isArray(data) && data.length > 0) return true;
      const { data: current, error: readError } = await admin!
        .from("appointments")
        .select("rebook_reminder_status")
        .eq("id", appointmentId)
        .maybeSingle();
      if (readError) {
        console.error(
          "rebook reminder skip reread failed:",
          appointmentId,
          readError.message,
        );
        return false;
      }
      return current?.rebook_reminder_status === "skipped";
    },
    markSent: async (appointmentId, sentAt) => {
      const { data, error } = await admin!
        .from("appointments")
        .update({
          rebook_reminder_status: "sent",
          rebook_reminder_sent_at: sentAt,
        })
        .eq("id", appointmentId)
        .eq("rebook_reminder_status", "sending")
        .select("id");
      if (error) {
        console.error(
          "rebook reminder sent mark failed:",
          appointmentId,
          error.message,
        );
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    },
    release: async (appointmentId) => {
      const { error } = await admin!
        .from("appointments")
        .update({ rebook_reminder_status: null })
        .eq("id", appointmentId)
        .eq("rebook_reminder_status", "sending");
      if (error) {
        console.error(
          "rebook reminder release failed:",
          appointmentId,
          error.message,
        );
      }
    },
    send: async (message) => {
      const result = await sendTrackedEmail(message);
      if (result.outcome === "accepted") return true;
      if (result.outcome === "failed" || result.outcome === "skipped") return false;
      return "uncertain";
    },
    trackVisitSend: async (input) => {
      const outcome = await deliverTrackedNotice({
        store: createSupabaseClaimStore(admin!),
        snapshot: {
          channel: "email",
          provider: "resend",
          notificationType: "rebook_reminder_21_day",
          audience: "customer",
          customerId: input.customerId,
          visitId: input.visitId,
          appointmentIds: input.appointmentIds,
          petIds: [],
          recipient: input.message.to,
          subject: input.message.subject,
          bodyText: input.message.text,
          bodyHtml: input.message.html,
          replyTo: null,
          idempotencyKey: communicationIdempotencyKey({
            channel: "email",
            notificationType: "rebook_reminder_21_day",
            audience: "customer",
            scope: communicationVisitScope(input.visitId),
            fingerprint: "-",
          }),
        },
        send: async () => {
          const result = await sendTrackedEmail(input.message);
          if (result.outcome === "skipped") {
            return { outcome: "failed" as const, error: "missing_config" };
          }
          return result;
        },
      });
      if (outcome === "accepted" || outcome === "duplicate") return true;
      if (outcome === "failed" || outcome === "unrecorded") return false;
      return "uncertain";
    },
  });
}

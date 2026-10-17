import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import {
  buildRebookReminderEmail,
} from "@/lib/email/rebook-reminder";
import { buildCommunicationContext } from "@/lib/communications/context";
import { isEmailConfigured, sendEmailDelivery } from "@/lib/email/resend";
import { formatVisitPetNames } from "@/lib/visits/pet-names";
import { recordVisitNotificationSent } from "@/lib/visits/notification-ledger";
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
  customerId: string;
  appointmentStatus: string;
  serviceEndedAt: string | null;
  reminderStatus: string | null;
  petName: string | null;
  customerEmail: string | null;
  customerFirstName: string | null;
  visitId?: string | null;
  petId?: string | null;
};

export type RebookReminderSendOutcome = boolean | "uncertain";

export type FutureAppointmentSnapshot = {
  id: string;
  status: string;
  appointmentDate: string;
  serviceEndedAt: string | null;
};

type DueRow = {
  id: string;
  customer_id: string;
  pet_id?: string | null;
  visit_id?: string | null;
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
  customer_id,
  pet_id,
  visit_id,
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
  send: (message: {
    to: string;
    subject: string;
    text: string;
    html: string;
    visitId: string | null;
    customerId: string;
    appointmentIds: string[];
    petIds: string[];
  }) => Promise<RebookReminderSendOutcome>;
};

function groupHasOpenFuture(
  appointments: FutureAppointmentSnapshot[],
  today: string,
  sourceIds: string[],
) {
  const excluded = new Set(sourceIds);
  return appointments.some(
    (appointment) =>
      !excluded.has(appointment.id) &&
      isOpenFutureAppointment(appointment, today, sourceIds[0] ?? ""),
  );
}

/** Dogs with no visit stay separate. Dogs on one visit share one email. */
export function groupRebookReminderCandidates(
  due: RebookReminderCandidate[],
  today: string,
) {
  const groups: RebookReminderCandidate[][] = [];
  const visitIndex = new Map<string, number>();
  for (const candidate of due) {
    if (!isRebookReminderDue(candidate, today)) continue;
    const visitId = candidate.visitId?.trim();
    if (!visitId) {
      groups.push([candidate]);
      continue;
    }
    const index = visitIndex.get(visitId);
    if (index == null) {
      visitIndex.set(visitId, groups.length);
      groups.push([candidate]);
    } else {
      groups[index]!.push(candidate);
    }
  }
  return groups;
}

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

  for (const group of groupRebookReminderCandidates(due, today)) {
    const ready = group.filter((candidate) => candidate.customerEmail?.trim());
    if (ready.length === 0) {
      skipped += group.length;
      continue;
    }

    const anchor = ready[0]!;
    const readyIds = ready.map((candidate) => candidate.id);
    const beforeSend = await deps.loadFuture(anchor.customerId, today);
    if (!beforeSend) {
      failed += ready.length;
      continue;
    }
    if (groupHasOpenFuture(beforeSend, today, readyIds)) {
      for (const candidate of ready) {
        const marked = await deps.markSkipped(candidate.id);
        if (marked) skipped += 1;
        else failed += 1;
      }
      continue;
    }

    const claimed: RebookReminderCandidate[] = [];
    for (const candidate of ready) {
      const ok = await deps.claim(candidate.id);
      if (ok) claimed.push(candidate);
      else skipped += 1;
    }
    if (claimed.length === 0) continue;

    const claimedIds = claimed.map((candidate) => candidate.id);
    const immediatelyBeforeSend = await deps.loadFuture(
      anchor.customerId,
      today,
    );
    if (!immediatelyBeforeSend) {
      for (const id of claimedIds) await deps.release(id);
      failed += claimed.length;
      continue;
    }
    if (groupHasOpenFuture(immediatelyBeforeSend, today, claimedIds)) {
      for (const id of claimedIds) {
        const marked = await deps.markSkipped(id);
        if (marked) skipped += 1;
        else failed += 1;
      }
      continue;
    }

    const email = buildRebookReminderEmail({
      firstName: anchor.customerFirstName,
      petName: formatVisitPetNames(
        claimed.map((candidate) => candidate.petName),
      ),
    });
    let delivered: RebookReminderSendOutcome = false;
    try {
      delivered = await deps.send({
        to: anchor.customerEmail!.trim(),
        subject: email.subject,
        text: email.text,
        html: email.html,
        visitId: anchor.visitId?.trim() || null,
        customerId: anchor.customerId,
        appointmentIds: claimedIds,
        petIds: claimed
          .map((candidate) => candidate.petId)
          .filter((id): id is string => Boolean(id)),
      });
    } catch (error) {
      console.error(
        "rebook reminder send threw:",
        claimedIds.join(","),
        error,
      );
      delivered = "uncertain";
    }

    if (delivered === "uncertain") {
      failed += claimed.length;
      continue;
    }
    if (!delivered) {
      for (const id of claimedIds) await deps.release(id);
      failed += claimed.length;
      continue;
    }

    let markedAll = true;
    for (const id of claimedIds) {
      const marked = await deps.markSent(id, new Date().toISOString());
      if (!marked) {
        markedAll = false;
        console.error(
          "rebook reminder was sent but the sent timestamp was not saved:",
          id,
        );
      }
    }
    if (!markedAll) {
      failed += 1;
      continue;
    }
    sent += 1;
  }

  return { sent, skipped, failed };
}

function mapDueRow(row: DueRow): RebookReminderCandidate {
  const pet = firstRelation(row.pets);
  const profile = firstRelation(row.profiles);
  return {
    id: row.id,
    customerId: row.customer_id,
    visitId: row.visit_id ?? null,
    petId: row.pet_id ?? null,
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
      const fingerprint = [...message.appointmentIds].sort().join(",");
      let delivery: "delivered" | "rejected" | "uncertain";
      try {
        delivery = await sendEmailDelivery({
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          communication: buildCommunicationContext({
            notificationType: "rebook_reminder_21_day",
            recipient: message.to,
            customerId: message.customerId,
            visitId: message.visitId,
            appointmentIds: message.appointmentIds,
            petIds: message.petIds,
            dedupe: message.visitId ? "visit" : "appointment",
            fingerprint,
          }),
        });
      } catch (error) {
        console.error("rebook reminder provider threw:", fingerprint, error);
        return "uncertain";
      }
      if (delivery === "delivered") {
        if (message.visitId) {
          try {
            await recordVisitNotificationSent(
              message.visitId,
              `rebook_reminder_21_day:${fingerprint}`,
            );
          } catch (error) {
            console.error(
              "rebook reminder visit record failed:",
              message.visitId,
              error,
            );
          }
        }
        return true;
      }
      if (delivery === "uncertain") return "uncertain";
      return false;
    },
  });
}

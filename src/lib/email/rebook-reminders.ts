import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import {
  buildRebookReminderEmail,
} from "@/lib/email/rebook-reminder";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
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
};

export type FutureAppointmentSnapshot = {
  id: string;
  status: string;
  appointmentDate: string;
  serviceEndedAt: string | null;
};

type DueRow = {
  id: string;
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
  send: (message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) => Promise<boolean>;
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

  for (const candidate of due) {
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
    let delivered = false;
    try {
      delivered = await deps.send({
        to: candidate.customerEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error) {
      console.error("rebook reminder send threw:", candidate.id, error);
      delivered = false;
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

function mapDueRow(row: DueRow): RebookReminderCandidate {
  const pet = firstRelation(row.pets);
  const profile = firstRelation(row.profiles);
  return {
    id: row.id,
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
    send: (message) => sendEmail(message),
  });
}

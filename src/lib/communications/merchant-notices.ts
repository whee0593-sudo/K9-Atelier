import { mapAppointmentRowToRecord } from "@/lib/appointments/map";
import type { AppointmentRecord, AppointmentRow } from "@/lib/appointments/types";
import { dispatchMerchantChannel } from "@/lib/communications/dispatch";
import { merchantIdempotencyKey } from "@/lib/communications/idempotency";
import {
  MERCHANT_NOTIFY_EMAIL,
  readMerchantFromAddress,
  readMerchantNotifyPhone,
} from "@/lib/communications/merchant-config";
import type {
  CommunicationSnapshot,
  CommunicationStore,
  DispatchOutcome,
  ProviderSendResult,
} from "@/lib/communications/store";
import { sendTrackedEmail, siteUrl } from "@/lib/email/resend";
import { formatAppointmentDateLabel } from "@/lib/email/html-templates";
import {
  buildStaffNotificationEmail,
  type StaffNotificationRow,
} from "@/lib/email/layout";
import { sendTrackedSms } from "@/lib/sms/twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { createSupabaseCommunicationStore } from "@/lib/communications/supabase-store";

export type MerchantPetLine = {
  appointmentId: string;
  petId: string;
  petName: string;
  serviceName: string;
  status: AppointmentRecord["status"];
};

export type MerchantVisitFacts = {
  visitId: string;
  customerId: string | null;
  customerName?: string | null;
  replyTo?: string | null;
  pets: MerchantPetLine[];
  whenLabel: string;
  addressLabel: string;
};

export type MerchantReschedulePhase = "requested" | "completed";

export type MerchantChannelSender = {
  email?: (input: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
  }) => Promise<ProviderSendResult>;
  sms?: (input: { to: string; body: string }) => Promise<ProviderSendResult>;
};

export type MerchantNotifyDeps = {
  store?: CommunicationStore | null;
  env?: NodeJS.ProcessEnv;
  sender?: MerchantChannelSender;
};

export type MerchantNotifySummary = {
  email: DispatchOutcome | "not_confirmed";
  sms: DispatchOutcome | "not_confirmed";
};

const CONFIRMED = "merchant_visit_confirmed";
const CANCELLED = "merchant_visit_cancelled";
const RESCHEDULE_COMPLETED = "merchant_reschedule_completed";
const RESCHEDULE_REQUESTED = "merchant_reschedule_requested";

export function merchantVisitIsConfirmed(pets: Array<{ status: string }>) {
  const active = pets.filter((pet) => pet.status !== "cancelled");
  return active.length > 0 && active.every((pet) => pet.status === "confirmed");
}

export function factsFromAppointments(
  appointments: AppointmentRecord[],
  extra?: { customerName?: string | null; replyTo?: string | null },
): MerchantVisitFacts | null {
  const visitId = appointments.find((row) => row.visitId)?.visitId ?? null;
  if (!visitId) return null;
  const ordered = [...appointments].sort(
    (left, right) => (left.scheduledStart ?? 0) - (right.scheduledStart ?? 0),
  );
  const anchor = ordered[0];
  if (!anchor) return null;
  return {
    visitId,
    customerId: anchor.customerId,
    customerName: extra?.customerName ?? null,
    replyTo: extra?.replyTo ?? null,
    whenLabel: `${formatAppointmentDateLabel(anchor.appointmentDate)}, ${anchor.appointmentTime}`,
    addressLabel: [
      anchor.addressStreet,
      anchor.addressCity,
      anchor.addressState,
      anchor.addressZip,
    ]
      .filter(Boolean)
      .join(", "),
    pets: ordered.map((row) => ({
      appointmentId: row.id,
      petId: row.petId,
      petName: row.petName,
      serviceName: row.serviceName,
      status: row.status,
    })),
  };
}

function petSummary(pets: MerchantPetLine[]) {
  return pets
    .map((pet) => `${pet.petName} · ${pet.serviceName}`)
    .join("; ");
}

function petNames(pets: MerchantPetLine[]) {
  const names = pets.map((pet) => pet.petName).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "the visit";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function staffLetter(input: {
  subject: string;
  intro: string;
  rows: StaffNotificationRow[];
  textLines: string[];
}) {
  const text = [...input.textLines, "", `Calendar: ${siteUrl("/admin/appointments")}`].join(
    "\n",
  );
  return buildStaffNotificationEmail(
    {
      subject: input.subject,
      introHtml: `<p style="margin:0 0 16px; font-size:15px;">${input.intro}</p>`,
      rows: input.rows,
      cta: { href: siteUrl("/admin/appointments"), label: "VIEW CALENDAR" },
    },
    text,
  );
}

export function buildMerchantVisitConfirmedCopy(facts: MerchantVisitFacts) {
  const subject = "New visit confirmed";
  const intro = "A visit is confirmed.";
  const letter = staffLetter({
    subject,
    intro,
    rows: detailRows(facts),
    textLines: [intro, "", ...plainDetails(facts)],
  });
  return {
    subject,
    emailText: letter.text,
    emailHtml: letter.html,
    sms: `K9 Atelier: New visit confirmed for ${petNames(facts.pets)} on ${facts.whenLabel}. ${facts.addressLabel}`,
  };
}

export function buildMerchantVisitCancelledCopy(facts: MerchantVisitFacts) {
  const subject = "Visit cancelled";
  const intro = "The customer cancelled this visit.";
  const letter = staffLetter({
    subject,
    intro,
    rows: detailRows(facts),
    textLines: [intro, "", ...plainDetails(facts)],
  });
  return {
    subject,
    emailText: letter.text,
    emailHtml: letter.html,
    sms: `K9 Atelier: Visit cancelled. ${petNames(facts.pets)}, ${facts.whenLabel}.`,
  };
}

export function buildMerchantRescheduleCopy(
  phase: MerchantReschedulePhase,
  facts: MerchantVisitFacts & { previousWhenLabel: string },
) {
  const completed = phase === "completed";
  const subject = completed ? "Visit rescheduled" : "Reschedule requested";
  const intro = completed
    ? "The customer rescheduled this visit. The new time is already on the calendar."
    : "The customer requested a reschedule. The visit time has not changed.";
  const rows: StaffNotificationRow[] = [
    { label: "Previous", value: facts.previousWhenLabel },
    {
      label: completed ? "New time" : "Requested time",
      value: facts.whenLabel,
    },
    ...detailRows(facts).filter((row) => row.label !== "When"),
  ];
  const letter = staffLetter({
    subject,
    intro,
    rows,
    textLines: [
      intro,
      "",
      `Previous: ${facts.previousWhenLabel}`,
      `${completed ? "New time" : "Requested time"}: ${facts.whenLabel}`,
      `Pets: ${petSummary(facts.pets)}`,
      `Address: ${facts.addressLabel}`,
    ],
  });
  const sms = completed
    ? `K9 Atelier: Visit rescheduled. ${petNames(facts.pets)}. Was ${facts.previousWhenLabel}. Now ${facts.whenLabel}.`
    : `K9 Atelier: Reschedule requested, not completed. ${petNames(facts.pets)}. Current time is unchanged. Requested ${facts.whenLabel}.`;
  return { subject, emailText: letter.text, emailHtml: letter.html, sms };
}

function detailRows(facts: MerchantVisitFacts): StaffNotificationRow[] {
  const rows: StaffNotificationRow[] = [
    { label: "Pets", value: petSummary(facts.pets) },
    { label: "When", value: facts.whenLabel },
    { label: "Address", value: facts.addressLabel },
  ];
  if (facts.customerName) rows.unshift({ label: "Customer", value: facts.customerName });
  return rows;
}

function plainDetails(facts: MerchantVisitFacts) {
  return detailRows(facts).map((row) => `${row.label}: ${row.value}`);
}

function snapshotBase(
  facts: MerchantVisitFacts,
  notificationType: string,
  channel: "email" | "sms",
  recipient: string,
  fingerprint?: string | null,
): Pick<
  CommunicationSnapshot,
  | "channel"
  | "notificationType"
  | "customerId"
  | "visitId"
  | "appointmentIds"
  | "petIds"
  | "recipient"
  | "idempotencyKey"
> {
  return {
    channel,
    notificationType,
    customerId: facts.customerId,
    visitId: facts.visitId,
    appointmentIds: facts.pets.map((pet) => pet.appointmentId),
    petIds: facts.pets.map((pet) => pet.petId),
    recipient,
    idempotencyKey: merchantIdempotencyKey({
      channel,
      notificationType,
      visitId: facts.visitId,
      recipient,
      fingerprint,
    }),
  };
}

function defaultStore(): CommunicationStore | null {
  if (!hasSupabaseAdminConfig()) return null;
  return createSupabaseCommunicationStore(createAdminClient());
}

async function sendPair(input: {
  facts: MerchantVisitFacts;
  notificationType: string;
  fingerprint?: string | null;
  subject: string;
  emailText: string;
  emailHtml: string;
  sms: string;
  deps?: MerchantNotifyDeps;
}): Promise<MerchantNotifySummary> {
  const store = input.deps?.store === undefined ? defaultStore() : input.deps.store;
  if (!store) {
    console.error(
      "MERCHANT_NOTIFY_UNRECORDED",
      input.facts.visitId,
      input.notificationType,
    );
    return { email: "unrecorded", sms: "unrecorded" };
  }
  const env = input.deps?.env ?? process.env;
  const from = readMerchantFromAddress(env);
  const phone = readMerchantNotifyPhone(env);
  const emailConfigured = Boolean(env.RESEND_API_KEY?.trim());
  const smsConfigured = Boolean(
    env.TWILIO_ACCOUNT_SID?.trim() &&
      env.TWILIO_AUTH_TOKEN?.trim() &&
      (env.TWILIO_FROM_NUMBER?.trim() || env.TWILIO_MESSAGING_SERVICE_SID?.trim()),
  );

  const emailRecipient = MERCHANT_NOTIFY_EMAIL;
  const emailSkipReason = !from.ok
    ? from.reason
    : !emailConfigured
      ? "missing_config"
      : null;
  const smsSkipReason = !phone
    ? "missing_config"
    : !smsConfigured
      ? "missing_config"
      : null;

  const emailSnapshot: CommunicationSnapshot = {
    ...snapshotBase(
      input.facts,
      input.notificationType,
      "email",
      emailSkipReason ? "missing" : emailRecipient,
      input.fingerprint,
    ),
    subject: input.subject,
    bodyText: input.emailText,
    bodyHtml: input.emailHtml,
    replyTo: input.facts.replyTo ?? null,
    provider: emailSkipReason ? null : "resend",
    intendedStatus: emailSkipReason ? "skipped" : "pending",
    skipReason: emailSkipReason,
  };

  const smsRecipient = smsSkipReason ? "missing" : phone!;
  const smsSnapshot: CommunicationSnapshot = {
    ...snapshotBase(
      input.facts,
      input.notificationType,
      "sms",
      smsRecipient,
      input.fingerprint,
    ),
    subject: null,
    bodyText: input.sms,
    bodyHtml: null,
    replyTo: null,
    provider: smsSkipReason ? null : "twilio",
    intendedStatus: smsSkipReason ? "skipped" : "pending",
    skipReason: smsSkipReason,
  };

  const sendEmail =
    input.deps?.sender?.email ??
    ((message) => sendTrackedEmail(message));
  const sendSms = input.deps?.sender?.sms ?? ((message) => sendTrackedSms(message));

  const [email, sms] = await Promise.all([
    dispatchMerchantChannel({
      store,
      snapshot: emailSnapshot,
      skip: Boolean(emailSkipReason),
      send: emailSkipReason
        ? undefined
        : () =>
            sendEmail({
              from: from.ok ? from.from : "",
              to: emailRecipient,
              subject: input.subject,
              text: input.emailText,
              html: input.emailHtml,
              replyTo: input.facts.replyTo ?? undefined,
            }),
    }),
    dispatchMerchantChannel({
      store,
      snapshot: smsSnapshot,
      skip: Boolean(smsSkipReason),
      send: smsSkipReason || !phone ? undefined : () => sendSms({ to: phone, body: input.sms }),
    }),
  ]);

  return { email, sms };
}

export async function notifyMerchantVisitConfirmed(
  facts: MerchantVisitFacts,
  deps?: MerchantNotifyDeps,
): Promise<MerchantNotifySummary> {
  if (!merchantVisitIsConfirmed(facts.pets)) {
    return { email: "not_confirmed", sms: "not_confirmed" };
  }
  const copy = buildMerchantVisitConfirmedCopy(facts);
  return sendPair({
    facts,
    notificationType: CONFIRMED,
    subject: copy.subject,
    emailText: copy.emailText,
    emailHtml: copy.emailHtml,
    sms: copy.sms,
    deps,
  });
}

export async function notifyMerchantVisitCancelled(
  facts: MerchantVisitFacts,
  deps?: MerchantNotifyDeps,
): Promise<MerchantNotifySummary> {
  const copy = buildMerchantVisitCancelledCopy(facts);
  return sendPair({
    facts,
    notificationType: CANCELLED,
    subject: copy.subject,
    emailText: copy.emailText,
    emailHtml: copy.emailHtml,
    sms: copy.sms,
    deps,
  });
}

export async function notifyMerchantReschedule(
  phase: MerchantReschedulePhase,
  facts: MerchantVisitFacts & { previousWhenLabel: string; fingerprint: string },
  deps?: MerchantNotifyDeps,
): Promise<MerchantNotifySummary> {
  const copy = buildMerchantRescheduleCopy(phase, facts);
  return sendPair({
    facts,
    notificationType:
      phase === "completed" ? RESCHEDULE_COMPLETED : RESCHEDULE_REQUESTED,
    fingerprint: facts.fingerprint,
    subject: copy.subject,
    emailText: copy.emailText,
    emailHtml: copy.emailHtml,
    sms: copy.sms,
    deps,
  });
}

export function rescheduleFingerprint(previousWhen: string, nextWhen: string) {
  return `${previousWhen}=>${nextWhen}`;
}

export async function notifyMerchantVisitConfirmedFromAppointments(
  appointments: AppointmentRecord[],
  extra?: { customerName?: string | null; replyTo?: string | null },
  deps?: MerchantNotifyDeps,
) {
  const facts = factsFromAppointments(appointments, extra);
  if (!facts) {
    console.error("MERCHANT_NOTIFY_UNRECORDED", "missing-visit");
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  return notifyMerchantVisitConfirmed(facts, deps);
}

const ALERT_PATTERN = /^v=(\S+) t=(\S+) c=(email|sms) fp=([\s\S]*)$/;

export function parseMerchantAlert(message: string) {
  const match = message.match(ALERT_PATTERN);
  if (!match) return null;
  return {
    visitId: match[1]!,
    notificationType: match[2]!,
    channel: match[3] as "email" | "sms",
    fingerprint: match[4] === "-" ? null : match[4]!,
  };
}

const TERMINAL_OUTCOMES = new Set<DispatchOutcome>([
  "accepted",
  "failed",
  "uncertain",
  "skipped",
  "duplicate",
]);

function bothChannelsSettled(summary: MerchantNotifySummary) {
  return (
    summary.email !== "not_confirmed" &&
    summary.sms !== "not_confirmed" &&
    TERMINAL_OUTCOMES.has(summary.email) &&
    TERMINAL_OUTCOMES.has(summary.sms)
  );
}

async function loadVisitFacts(visitId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(
      `
      id, customer_id, pet_id, visit_id, service_id, service_name,
      add_on_ids, add_on_options, address_street, address_city, address_state, address_zip,
      travel_distance_miles, travel_fee, appointment_date, appointment_time, scheduled_start,
      time_preference, timezone, estimated_total, new_client_deposit,
      vaccination_status_at_booking, status, confirmed_at, created_at,
      pets ( name, breed )
    `,
    )
    .eq("visit_id", visitId);
  if (error || !data?.length) return null;
  return factsFromAppointments(
    (data as unknown as AppointmentRow[]).map((row) => mapAppointmentRowToRecord(row)),
  );
}

/**
 * Retries merchant notices whose log claim could not be saved.
 * A later successful claim sends once. An accepted or in-flight row is not sent again.
 */
export async function replayDeferredMerchantAlerts(deps?: MerchantNotifyDeps & {
  loadVisit?: (visitId: string) => Promise<MerchantVisitFacts | null>;
}): Promise<{ replayed: number; kept: number }> {
  const store = deps?.store === undefined ? defaultStore() : deps.store;
  if (!store) return { replayed: 0, kept: 0 };
  const loadVisit = deps?.loadVisit ?? loadVisitFacts;
  const alerts = await store.listAlerts("claim_unavailable");
  let replayed = 0;
  let kept = 0;
  for (const alert of alerts) {
    const parsed = parseMerchantAlert(alert.message);
    if (!parsed) {
      kept += 1;
      continue;
    }
    const facts = await loadVisit(parsed.visitId);
    if (!facts) {
      kept += 1;
      continue;
    }
    let summary: MerchantNotifySummary;
    if (parsed.notificationType === CONFIRMED) {
      summary = await notifyMerchantVisitConfirmed(facts, deps);
    } else if (parsed.notificationType === CANCELLED) {
      summary = await notifyMerchantVisitCancelled(facts, deps);
    } else if (
      parsed.notificationType === RESCHEDULE_COMPLETED ||
      parsed.notificationType === RESCHEDULE_REQUESTED
    ) {
      const [previousWhenLabel, nextWhenLabel] = (parsed.fingerprint ?? "").split("=>");
      summary = await notifyMerchantReschedule(
        parsed.notificationType === RESCHEDULE_COMPLETED ? "completed" : "requested",
        {
          ...facts,
          previousWhenLabel: previousWhenLabel || facts.whenLabel,
          whenLabel: nextWhenLabel || facts.whenLabel,
          fingerprint: parsed.fingerprint ?? rescheduleFingerprint(facts.whenLabel, facts.whenLabel),
        },
        deps,
      );
    } else {
      kept += 1;
      continue;
    }
    if (!bothChannelsSettled(summary)) {
      kept += 1;
      continue;
    }
    await store.deleteAlert(alert.id);
    replayed += 1;
  }
  return { replayed, kept };
}

export async function notifyMerchantRescheduleCompletedFromAppointments(
  appointments: AppointmentRecord[],
  previousWhenLabel: string,
  extra?: { customerName?: string | null; replyTo?: string | null },
  deps?: MerchantNotifyDeps,
) {
  const facts = factsFromAppointments(appointments, extra);
  if (!facts) {
    console.error("MERCHANT_NOTIFY_UNRECORDED", "missing-visit");
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  return notifyMerchantReschedule(
    "completed",
    {
      ...facts,
      previousWhenLabel,
      fingerprint: rescheduleFingerprint(previousWhenLabel, facts.whenLabel),
    },
    deps,
  );
}

export async function notifyMerchantVisitCancelledFromAppointments(
  appointments: AppointmentRecord[],
  extra?: { customerName?: string | null; replyTo?: string | null },
  deps?: MerchantNotifyDeps,
) {
  const facts = factsFromAppointments(appointments, extra);
  if (!facts) {
    console.error("MERCHANT_NOTIFY_UNRECORDED", "missing-visit");
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  return notifyMerchantVisitCancelled(facts, deps);
}

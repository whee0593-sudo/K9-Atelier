import { mapAppointmentRowToRecord } from "@/lib/appointments/map";
import type { AppointmentRecord, AppointmentRow } from "@/lib/appointments/types";
import { buildCommunicationContext } from "@/lib/communications/context";
import { dispatchCommunication } from "@/lib/communications/dispatch";
import {
  MERCHANT_NOTIFY_EMAIL,
  readMerchantFromAddress,
  readMerchantNotifyPhone,
} from "@/lib/communications/merchant-config";
import type { ProviderAttemptResult } from "@/lib/communications/provider-outcome";
import type { CommunicationSendResult } from "@/lib/communications/result";
import type { CommunicationLogStore } from "@/lib/communications/store";
import { createSupabaseCommunicationLogStore } from "@/lib/communications/supabase-store";
import { siteUrl } from "@/lib/email/site-url";
import { formatAppointmentDateLabel } from "@/lib/email/html-templates";
import {
  buildStaffNotificationEmail,
  type StaffNotificationRow,
} from "@/lib/email/layout";
import { isSmsConfigured } from "@/lib/sms/twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { isEmailConfigured } from "@/lib/email/resend";

export type MerchantPetLine = {
  appointmentId: string;
  petId: string;
  petName: string;
  serviceName: string;
  status: AppointmentRecord["status"];
};

export type MerchantVisitFacts = {
  visitId: string | null;
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
  }) => Promise<{ outcome: "accepted" | "rejected" | "uncertain"; providerMessageId?: string | null; errorMessage?: string }>;
  sms?: (input: { to: string; body: string }) => Promise<{ outcome: "accepted" | "rejected" | "uncertain"; providerMessageId?: string | null; errorMessage?: string }>;
};

export type MerchantNotifyDeps = {
  store?: CommunicationLogStore | null;
  env?: NodeJS.ProcessEnv;
  sender?: MerchantChannelSender;
  listAlerts?: (code: string) => Promise<Array<{ id: string; message: string }>>;
  deleteAlert?: (id: string) => Promise<void>;
};

export type MerchantChannelOutcome =
  | "accepted"
  | "duplicate"
  | "failed"
  | "uncertain"
  | "skipped"
  | "unrecorded";

export type MerchantNotifySummary = {
  email: MerchantChannelOutcome | "not_confirmed";
  sms: MerchantChannelOutcome | "not_confirmed";
};

const CONFIRMED = "merchant_visit_confirmed";
const CANCELLED = "merchant_visit_cancelled";
const RESCHEDULE_COMPLETED = "merchant_reschedule_completed";
const RESCHEDULE_REQUESTED = "merchant_reschedule_requested";
const PETS_CHANGED = "merchant_visit_pets_changed";
const CUSTOMER_REPLY_C = "merchant_customer_reply_c";
export const MERCHANT_REPLAY_ALERT = "MERCHANT_REPLAY";

const VISIT_SELECT = `
  id, customer_id, pet_id, service_id, service_name, add_on_ids, add_on_options,
  address_street, address_city, address_state, address_zip, travel_distance_miles,
  travel_fee, appointment_date, appointment_time, scheduled_start, visit_id,
  estimated_duration_minutes, time_preference, timezone, estimated_total,
  new_client_deposit, vaccination_status_at_booking, status, confirmed_at,
  customer_confirmed_at, created_at, pets ( name, breed )
`;

export function merchantVisitIsConfirmed(pets: Array<{ status: string }>) {
  const active = pets.filter((pet) => pet.status !== "cancelled");
  return active.length > 0 && active.every((pet) => pet.status === "confirmed");
}

export function factsFromAppointments(
  appointments: AppointmentRecord[],
  extra?: { customerName?: string | null; replyTo?: string | null },
): MerchantVisitFacts | null {
  const visitId = appointments.find((row) => row.visitId)?.visitId ?? null;
  // A visit keeps main's grouped notice. One old appointment with no visit
  // still notifies, keyed by that appointment. Several ungrouped rows do not.
  if (!visitId && appointments.length !== 1) return null;
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
  return pets.map((pet) => `${pet.petName} · ${pet.serviceName}`).join("; ");
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

export type MerchantPetsChangedFacts = MerchantVisitFacts & {
  previousPets: MerchantPetLine[];
};

export function rosterFingerprint(
  previous: MerchantPetLine[],
  next: MerchantPetLine[],
) {
  const side = (pets: MerchantPetLine[]) =>
    [...new Set(pets.map((pet) => pet.petId).filter(Boolean))].sort().join(",");
  return `${side(previous)}=>${side(next)}`;
}

export function rosterChanged(
  previous: MerchantPetLine[],
  next: MerchantPetLine[],
) {
  const [before, after] = rosterFingerprint(previous, next).split("=>");
  return before !== after;
}

export function buildMerchantVisitPetsChangedCopy(facts: MerchantPetsChangedFacts) {
  const subject = "Dogs on this visit changed";
  const intro =
    "The dogs on this visit changed. This notice is only that roster change. It is not a new confirmation, and it is not a cancellation of the whole visit.";
  const rows: StaffNotificationRow[] = [
    { label: "Previous dogs", value: petSummary(facts.previousPets) || "None" },
    { label: "Current dogs", value: petSummary(facts.pets) || "None" },
    { label: "When", value: facts.whenLabel },
    { label: "Address", value: facts.addressLabel },
  ];
  if (facts.customerName) rows.unshift({ label: "Customer", value: facts.customerName });
  const letter = staffLetter({
    subject,
    intro,
    rows,
    textLines: [
      intro,
      "",
      `Previous dogs: ${petSummary(facts.previousPets) || "None"}`,
      `Current dogs: ${petSummary(facts.pets) || "None"}`,
      `When: ${facts.whenLabel}`,
      `Address: ${facts.addressLabel}`,
    ],
  });
  return {
    subject,
    emailText: letter.text,
    emailHtml: letter.html,
    sms: `K9 Atelier: Dogs on this visit changed. Was ${petNames(facts.previousPets)}. Now ${petNames(facts.pets)}. ${facts.whenLabel}.`,
  };
}

export function buildMerchantCustomerReplyCCopy(input: {
  customerName?: string | null;
  petName: string;
  serviceName: string;
  whenLabel: string;
}) {
  const subject = `[K9 Atelier] Customer confirmed — ${input.petName}`;
  const intro =
    "The customer replied C to confirm. This is the customer SMS confirmation. It does not change staff or vaccination booking status, and it is not a new visit confirmation.";
  const who = input.customerName?.trim() || "A customer";
  const letter = staffLetter({
    subject,
    intro,
    rows: [
      { label: "Customer", value: who },
      { label: "Pet", value: input.petName },
      { label: "Service", value: input.serviceName },
      { label: "When", value: input.whenLabel },
    ],
    textLines: [
      intro,
      "",
      `${who} replied C to confirm.`,
      "",
      `Pet: ${input.petName}`,
      `Service: ${input.serviceName}`,
      `Date: ${input.whenLabel}`,
    ],
  });
  return { subject, emailText: letter.text, emailHtml: letter.html };
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

export function rescheduleFingerprint(previousWhen: string, nextWhen: string) {
  return `${previousWhen}=>${nextWhen}`;
}

function activeStore(explicit?: CommunicationLogStore | null) {
  if (explicit) return explicit;
  if (!hasSupabaseAdminConfig()) return null;
  return createSupabaseCommunicationLogStore();
}

function asProviderAttempt(result: {
  outcome: "accepted" | "rejected" | "uncertain";
  providerMessageId?: string | null;
  errorMessage?: string;
}): ProviderAttemptResult {
  if (result.outcome === "accepted") {
    return {
      outcome: "accepted",
      providerMessageId: result.providerMessageId ?? null,
    };
  }
  if (result.outcome === "rejected") {
    return {
      outcome: "rejected",
      errorMessage: result.errorMessage ?? "rejected",
    };
  }
  return {
    outcome: "uncertain",
    errorMessage: result.errorMessage ?? "uncertain",
  };
}

function outcomeOf(result: CommunicationSendResult): MerchantChannelOutcome {
  if (result.status === "accepted") return "accepted";
  if (result.status === "duplicate") return "duplicate";
  if (result.status === "uncertain") return "uncertain";
  if (result.status === "skipped") return "skipped";
  if (result.logError && !result.providerMessageId && result.status === "failed") {
    return "unrecorded";
  }
  return "failed";
}

function merchantAlertScope(facts: MerchantVisitFacts) {
  if (facts.visitId) return facts.visitId;
  const appointmentId = facts.pets[0]?.appointmentId.trim() ?? "";
  return appointmentId ? `appointment:${appointmentId}` : "appointment:missing";
}

function replayMessage(input: {
  visitId: string;
  notificationType: string;
  channel: "email" | "sms";
  fingerprint?: string | null;
}) {
  return `v=${input.visitId} t=${input.notificationType} c=${input.channel} fp=${input.fingerprint?.trim() || "-"}`;
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

async function sendChannel(input: {
  facts: MerchantVisitFacts;
  notificationType: string;
  fingerprint?: string | null;
  channel: "email" | "sms";
  subject: string;
  emailText: string;
  emailHtml: string;
  sms: string;
  deps?: MerchantNotifyDeps;
}): Promise<MerchantChannelOutcome> {
  const store = activeStore(input.deps?.store);
  if (!store) return "unrecorded";
  const env = input.deps?.env ?? process.env;
  const from = readMerchantFromAddress(env);
  const phone = readMerchantNotifyPhone(env);
  const emailReady = from.ok && isEmailConfiguredFor(env);
  const smsReady = Boolean(phone) && isSmsConfiguredFor(env);
  const recipient =
    input.channel === "email" ? MERCHANT_NOTIFY_EMAIL : (phone ?? "");
  const configured = input.channel === "email" ? emailReady : smsReady;
  const recipientValid =
    input.channel === "email"
      ? from.ok || from.reason === "missing_config"
      : true;
  const context = buildCommunicationContext({
    notificationType: input.notificationType,
    audience: "staff",
    recipient: recipient || "missing",
    customerId: input.facts.customerId,
    visitId: input.facts.visitId,
    appointmentIds: input.facts.pets.map((pet) => pet.appointmentId),
    petIds: input.facts.pets.map((pet) => pet.petId),
    dedupe: "visit",
    fingerprint: input.fingerprint ?? undefined,
  });


  const result = await dispatchCommunication({
    channel: input.channel,
    provider: input.channel === "email" ? "resend" : "twilio",
    recipient: recipient || "missing",
    subject: input.channel === "email" ? input.subject : null,
    bodyText: input.channel === "email" ? input.emailText : input.sms,
    bodyHtml: input.channel === "email" ? input.emailHtml : null,
    replyTo: input.channel === "email" ? input.facts.replyTo ?? null : null,
    context,
    configured,
    recipientValid,
    store,
    send: async () => {
      if (input.channel === "email") {
        const send = input.deps?.sender?.email;
        if (!send || !from.ok) {
          return {
            outcome: "rejected" as const,
            errorMessage: "merchant email sender missing",
          };
        }
        return asProviderAttempt(
          await send({
            from: from.from,
            to: MERCHANT_NOTIFY_EMAIL,
            subject: input.subject,
            text: input.emailText,
            html: input.emailHtml,
            replyTo: input.facts.replyTo ?? undefined,
          }),
        );
      }
      const send = input.deps?.sender?.sms;
      if (!send || !phone) {
        return {
          outcome: "rejected" as const,
          errorMessage: "merchant sms sender missing",
        };
      }
      return asProviderAttempt(await send({ to: phone, body: input.sms }));
    },
  });

  if (outcomeOf(result) === "unrecorded") {
    await store.recordAlert({
      code: MERCHANT_REPLAY_ALERT,
      message: replayMessage({
        visitId: merchantAlertScope(input.facts),
        notificationType: input.notificationType,
        channel: input.channel,
        fingerprint: input.fingerprint,
      }),
      logId: result.logId,
      idempotencyKey: context.idempotencyKey,
    });
  }
  return outcomeOf(result);
}

function isEmailConfiguredFor(env: NodeJS.ProcessEnv) {
  if (env === process.env) return isEmailConfigured();
  return Boolean(env.RESEND_API_KEY?.trim());
}

function isSmsConfiguredFor(env: NodeJS.ProcessEnv) {
  if (env === process.env) return isSmsConfigured();
  return Boolean(
    env.TWILIO_ACCOUNT_SID?.trim() &&
      env.TWILIO_AUTH_TOKEN?.trim() &&
      (env.TWILIO_FROM_NUMBER?.trim() || env.TWILIO_MESSAGING_SERVICE_SID?.trim()),
  );
}

async function sendPair(input: {
  facts: MerchantVisitFacts;
  notificationType: string;
  fingerprint?: string | null;
  subject: string;
  emailText: string;
  emailHtml: string;
  sms: string;
  includeSms?: boolean;
  deps?: MerchantNotifyDeps;
}): Promise<MerchantNotifySummary> {
  const email = await sendChannel({ ...input, channel: "email" });
  if (input.includeSms === false) return { email, sms: "skipped" };
  const sms = await sendChannel({ ...input, channel: "sms" });
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
) {
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
) {
  const copy = buildMerchantRescheduleCopy(phase, facts);
  return sendPair({
    facts,
    notificationType: phase === "completed" ? RESCHEDULE_COMPLETED : RESCHEDULE_REQUESTED,
    fingerprint: facts.fingerprint,
    subject: copy.subject,
    emailText: copy.emailText,
    emailHtml: copy.emailHtml,
    sms: copy.sms,
    deps,
  });
}

export async function notifyMerchantVisitPetsChanged(
  facts: MerchantPetsChangedFacts,
  deps?: MerchantNotifyDeps,
) {
  if (!rosterChanged(facts.previousPets, facts.pets)) {
    return { email: "skipped" as const, sms: "skipped" as const };
  }
  const copy = buildMerchantVisitPetsChangedCopy(facts);
  return sendPair({
    facts,
    notificationType: PETS_CHANGED,
    fingerprint: rosterFingerprint(facts.previousPets, facts.pets),
    subject: copy.subject,
    emailText: copy.emailText,
    emailHtml: copy.emailHtml,
    sms: copy.sms,
    deps,
  });
}

export async function notifyMerchantCustomerReplyC(
  input: {
    visitId: string | null;
    customerId: string | null;
    customerName?: string | null;
    replyTo?: string | null;
    appointmentId: string;
    petId: string;
    petName: string;
    serviceName: string;
    whenLabel: string;
    addressLabel: string;
  },
  deps?: MerchantNotifyDeps,
) {
  const facts: MerchantVisitFacts = {
    visitId: input.visitId,
    customerId: input.customerId,
    customerName: input.customerName,
    replyTo: input.replyTo,
    whenLabel: input.whenLabel,
    addressLabel: input.addressLabel,
    pets: [
      {
        appointmentId: input.appointmentId,
        petId: input.petId,
        petName: input.petName,
        serviceName: input.serviceName,
        status: "confirmed",
      },
    ],
  };
  const copy = buildMerchantCustomerReplyCCopy(input);
  return sendPair({
    facts,
    notificationType: CUSTOMER_REPLY_C,
    fingerprint: input.appointmentId,
    subject: copy.subject,
    emailText: copy.emailText,
    emailHtml: copy.emailHtml,
    sms: "",
    includeSms: false,
    deps,
  });
}

export async function loadVisitAppointments(
  visitId: string,
): Promise<AppointmentRecord[] | null> {
  if (!hasSupabaseAdminConfig()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(VISIT_SELECT)
    .eq("visit_id", visitId);
  if (error) {
    console.error("loadVisitAppointments failed:", error.message);
    return null;
  }
  return ((data ?? []) as unknown as AppointmentRow[]).map(mapAppointmentRowToRecord);
}

export async function notifyMerchantVisitConfirmedFromVisit(
  visitId: string | null | undefined,
  extra?: { customerName?: string | null; replyTo?: string | null },
  deps?: MerchantNotifyDeps,
) {
  if (!visitId) {
    console.error("MERCHANT_NOTIFY_UNRECORDED", "missing-visit");
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  const appointments = await loadVisitAppointments(visitId);
  if (!appointments) {
    console.error("MERCHANT_NOTIFY_UNRECORDED", "missing-visit", visitId);
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  return notifyMerchantVisitConfirmedFromAppointments(appointments, extra, deps);
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

export async function notifyMerchantVisitPetsChangedFromAppointments(
  previous: AppointmentRecord[],
  next: AppointmentRecord[],
  extra?: { customerName?: string | null; replyTo?: string | null },
  deps?: MerchantNotifyDeps,
) {
  const nextFacts = factsFromAppointments(next.length > 0 ? next : previous, extra);
  const previousFacts = factsFromAppointments(previous, extra);
  if (!nextFacts || !previousFacts) {
    console.error("MERCHANT_NOTIFY_UNRECORDED", "missing-visit", PETS_CHANGED);
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  const active = (pets: MerchantPetLine[]) =>
    pets.filter((pet) => pet.status !== "cancelled");
  return notifyMerchantVisitPetsChanged(
    {
      ...nextFacts,
      previousPets: active(previousFacts.pets),
      pets: active(nextFacts.pets),
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

async function replayMerchantAlert(
  parsed: NonNullable<ReturnType<typeof parseMerchantAlert>>,
  facts: MerchantVisitFacts,
  deps?: MerchantNotifyDeps,
): Promise<MerchantNotifySummary | null> {
  if (parsed.notificationType === CONFIRMED) {
    return notifyMerchantVisitConfirmed(facts, deps);
  }
  if (parsed.notificationType === CANCELLED) {
    return notifyMerchantVisitCancelled(facts, deps);
  }
  if (
    parsed.notificationType === RESCHEDULE_COMPLETED ||
    parsed.notificationType === RESCHEDULE_REQUESTED
  ) {
    const [previousWhenLabel, nextWhenLabel] = (parsed.fingerprint ?? "").split("=>");
    return notifyMerchantReschedule(
      parsed.notificationType === RESCHEDULE_COMPLETED ? "completed" : "requested",
      {
        ...facts,
        previousWhenLabel: previousWhenLabel || facts.whenLabel,
        whenLabel: nextWhenLabel || facts.whenLabel,
        fingerprint: parsed.fingerprint ?? rescheduleFingerprint(facts.whenLabel, facts.whenLabel),
      },
      deps,
    );
  }
  if (parsed.notificationType === CUSTOMER_REPLY_C) {
    const pet = facts.pets.find((row) => row.appointmentId === parsed.fingerprint);
    if (!pet) return null;
    return notifyMerchantCustomerReplyC(
      {
        visitId: facts.visitId,
        customerId: facts.customerId,
        customerName: facts.customerName,
        replyTo: facts.replyTo,
        appointmentId: pet.appointmentId,
        petId: pet.petId,
        petName: pet.petName,
        serviceName: pet.serviceName,
        whenLabel: facts.whenLabel,
        addressLabel: facts.addressLabel,
      },
      deps,
    );
  }
  return null;
}

function channelSettled(outcome: MerchantChannelOutcome | "not_confirmed") {
  return (
    outcome === "accepted" ||
    outcome === "failed" ||
    outcome === "uncertain" ||
    outcome === "duplicate" ||
    outcome === "skipped"
  );
}

async function loadHistoricalAppointmentFacts(
  appointmentId: string,
): Promise<MerchantVisitFacts | null> {
  if (!appointmentId || !hasSupabaseAdminConfig()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(VISIT_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();
  if (error || !data) {
    if (error) {
      console.error("loadHistoricalAppointmentFacts failed:", error.message);
    }
    return null;
  }
  return factsFromAppointments([
    mapAppointmentRowToRecord(data as unknown as AppointmentRow),
  ]);
}

async function loadVisitFacts(scopeId: string): Promise<MerchantVisitFacts | null> {
  if (scopeId.startsWith("appointment:")) {
    return loadHistoricalAppointmentFacts(scopeId.slice("appointment:".length));
  }
  const appointments = await loadVisitAppointments(scopeId);
  if (!appointments) return null;
  return factsFromAppointments(appointments);
}

async function listProductionAlerts(excludeIds: string[] = []) {
  if (!hasSupabaseAdminConfig()) return [];
  const admin = createAdminClient();
  let query = admin
    .from("communication_log_alerts")
    .select("id, message")
    .eq("code", MERCHANT_REPLAY_ALERT)
    .order("created_at", { ascending: true })
    .limit(25);
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as Array<{ id: string; message: string }>;
}

async function deleteProductionAlert(id: string) {
  if (!hasSupabaseAdminConfig()) return;
  const admin = createAdminClient();
  await admin.from("communication_log_alerts").delete().eq("id", id);
}

export async function replayDeferredMerchantAlerts(
  deps?: MerchantNotifyDeps & {
    loadVisit?: (visitId: string) => Promise<MerchantVisitFacts | null>;
  },
): Promise<{ replayed: number; kept: number }> {
  const list = deps?.listAlerts;
  const remove = deps?.deleteAlert ?? deleteProductionAlert;
  const loadVisit = deps?.loadVisit ?? loadVisitFacts;
  let replayed = 0;
  const blocked: string[] = [];
  for (let batch = 0; batch < 8; batch += 1) {
    const alerts = (
      list
        ? await list(MERCHANT_REPLAY_ALERT)
        : await listProductionAlerts(blocked)
    ).filter((alert) => !blocked.includes(alert.id));
    if (alerts.length === 0) break;
    let progress = 0;
    for (const alert of alerts.slice(0, 25)) {
      const parsed = parseMerchantAlert(alert.message);
      const facts =
        parsed && loadVisit ? await loadVisit(parsed.visitId) : null;
      if (!parsed || !facts) {
        blocked.push(alert.id);
        continue;
      }
      const summary = await replayMerchantAlert(parsed, facts, deps);
      const outcome = summary?.[parsed.channel];
      if (!outcome || !channelSettled(outcome)) {
        blocked.push(alert.id);
        continue;
      }
      await remove(alert.id);
      replayed += 1;
      progress += 1;
    }
    if (progress === 0 && alerts.length < 25) break;
  }
  const remaining = (
    list ? await list(MERCHANT_REPLAY_ALERT) : await listProductionAlerts(blocked)
  ).filter((alert) => !blocked.includes(alert.id));
  return { replayed, kept: remaining.length + blocked.length };
}

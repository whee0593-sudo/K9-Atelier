import { mapAppointmentRowToRecord } from "@/lib/appointments/map";
import type { AppointmentRecord, AppointmentRow } from "@/lib/appointments/types";
import { dispatchMerchantChannel } from "@/lib/communications/dispatch";
import {
  merchantIdempotencyKey,
  merchantVisitScope,
} from "@/lib/communications/idempotency";
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
const PETS_CHANGED = "merchant_visit_pets_changed";
const CUSTOMER_REPLY_C = "merchant_customer_reply_c";

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
      scope: merchantVisitScope(facts.visitId),
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
  includeSms?: boolean;
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

  const emailPromise = dispatchMerchantChannel({
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
  });
  if (input.includeSms === false) {
    return { email: await emailPromise, sms: "skipped" };
  }
  const [email, sms] = await Promise.all([
    emailPromise,
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

export async function notifyMerchantVisitPetsChanged(
  facts: MerchantPetsChangedFacts,
  deps?: MerchantNotifyDeps,
): Promise<MerchantNotifySummary> {
  if (!rosterChanged(facts.previousPets, facts.pets)) {
    return { email: "not_confirmed", sms: "not_confirmed" };
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
    addressLabel?: string;
  },
  deps?: MerchantNotifyDeps,
): Promise<MerchantNotifySummary> {
  if (!input.visitId) {
    console.error("MERCHANT_NOTIFY_UNRECORDED", "missing-visit", CUSTOMER_REPLY_C);
    return { email: "unrecorded", sms: "skipped" };
  }
  const facts: MerchantVisitFacts = {
    visitId: input.visitId,
    customerId: input.customerId,
    customerName: input.customerName ?? null,
    replyTo: input.replyTo ?? null,
    whenLabel: input.whenLabel,
    addressLabel: input.addressLabel ?? "",
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
  const copy = buildMerchantCustomerReplyCCopy({
    customerName: input.customerName,
    petName: input.petName,
    serviceName: input.serviceName,
    whenLabel: input.whenLabel,
  });
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

function channelSettled(outcome: DispatchOutcome | "not_confirmed") {
  return (
    outcome === "accepted" ||
    outcome === "failed" ||
    outcome === "uncertain" ||
    outcome === "duplicate"
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

function petsFromIds(all: MerchantPetLine[], csv: string) {
  const ids = csv.split(",").map((id) => id.trim()).filter(Boolean);
  const lines: MerchantPetLine[] = [];
  for (const id of ids) {
    const pet = all.find((row) => row.petId === id);
    if (!pet) return null;
    lines.push(pet);
  }
  return lines;
}

async function replayOneAlert(
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
        fingerprint:
          parsed.fingerprint ?? rescheduleFingerprint(facts.whenLabel, facts.whenLabel),
      },
      deps,
    );
  }
  if (parsed.notificationType === PETS_CHANGED) {
    const sides = (parsed.fingerprint ?? "").split("=>");
    if (sides.length !== 2) return null;
    const previousPets = petsFromIds(facts.pets, sides[0] ?? "");
    const currentPets = petsFromIds(facts.pets, sides[1] ?? "");
    if (!previousPets || !currentPets) return null;
    return notifyMerchantVisitPetsChanged(
      { ...facts, previousPets, pets: currentPets },
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

/**
 * Retries merchant notices whose log claim could not be saved.
 * Drains up to eight batches. A batch that cannot claim or finish stops the loop.
 * uncertain, failed, and any row with provider_called_at are not sent again.
 * A skipped row stays queued until config exists, then one claim sends it.
 */
export async function replayDeferredMerchantAlerts(deps?: MerchantNotifyDeps & {
  loadVisit?: (visitId: string) => Promise<MerchantVisitFacts | null>;
}): Promise<{ replayed: number; kept: number }> {
  const store = deps?.store === undefined ? defaultStore() : deps.store;
  if (!store) return { replayed: 0, kept: 0 };
  const loadVisit = deps?.loadVisit ?? loadVisitFacts;
  let replayed = 0;
  for (let batch = 0; batch < 8; batch += 1) {
    const alerts = await store.listAlerts("claim_unavailable");
    if (alerts.length === 0) return { replayed, kept: 0 };
    let progress = 0;
    for (const alert of alerts) {
      const parsed = parseMerchantAlert(alert.message);
      if (!parsed) continue;
      const facts = await loadVisit(parsed.visitId);
      if (!facts) continue;
      const summary = await replayOneAlert(parsed, facts, deps);
      if (!summary || !channelSettled(summary[parsed.channel])) continue;
      await store.deleteAlert(alert.id);
      replayed += 1;
      progress += 1;
    }
    if (progress === 0) break;
  }
  const remaining = await store.listAlerts("claim_unavailable");
  return { replayed, kept: remaining.length };
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

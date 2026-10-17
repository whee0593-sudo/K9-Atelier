import { mapAppointmentRowToRecord } from "@/lib/appointments/map";
import type { AppointmentRecord, AppointmentRow } from "@/lib/appointments/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { createSupabaseClaimStore } from "@/lib/communications/supabase-store";
import { deliverTrackedNotice, type DeliveryOutcome } from "@/lib/communications/deliver";
import {
  communicationAppointmentScope,
  communicationIdempotencyKey,
  communicationVisitScope,
} from "@/lib/communications/keys";
import {
  MERCHANT_NOTIFY_EMAIL,
  readMerchantFromAddress,
  readMerchantNotifyPhone,
  type MerchantEnv,
} from "@/lib/communications/merchant-config";
import { sendTrackedEmail, sendTrackedSms } from "@/lib/communications/provider";
import type { CommunicationClaimStore } from "@/lib/communications/store";
import type { ProviderAttempt } from "@/lib/communications/types";
import {
  joinPetNames,
  merchantVisitIsConfirmed,
} from "@/lib/communications/visit-readiness";
import { buildStaffNotificationEmail, escapeHtml } from "@/lib/email/layout";
import { siteUrl } from "@/lib/email/resend";
import { formatAppointmentDateLabel } from "@/lib/email/html-templates";

export const MERCHANT_VISIT_CONFIRMED = "merchant_visit_confirmed";
export const MERCHANT_CUSTOMER_REPLY_C = "merchant_customer_reply_c";
export const MERCHANT_VISIT_PET_ADDED = "merchant_visit_pet_added";

const MERCHANT_REPLAY_TYPES = [
  MERCHANT_VISIT_CONFIRMED,
  MERCHANT_CUSTOMER_REPLY_C,
  MERCHANT_VISIT_PET_ADDED,
];

export type MerchantPetLine = {
  appointmentId: string;
  petId: string;
  petName: string;
  serviceName: string;
  status: string;
};

export type MerchantVisitFacts = {
  visitId: string | null;
  customerId: string | null;
  customerName: string | null;
  replyTo: string | null;
  whenLabel: string;
  addressLabel: string;
  pets: MerchantPetLine[];
};

export type MerchantNotifySummary = {
  email: DeliveryOutcome | "not_confirmed" | "unrecorded";
  sms: DeliveryOutcome | "not_confirmed" | "unrecorded";
};

function activePets(pets: MerchantPetLine[]) {
  return pets.filter((pet) => pet.status !== "cancelled");
}

export function factsFromAppointments(
  appointments: AppointmentRecord[],
  extra?: { customerName?: string | null; replyTo?: string | null },
): MerchantVisitFacts | null {
  const visitIds = [
    ...new Set(
      appointments
        .map((row) => row.visitId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (visitIds.length > 1) return null;
  const visitId = visitIds[0] ?? null;
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

export function buildMerchantVisitConfirmedCopy(facts: MerchantVisitFacts) {
  const pets = activePets(facts.pets);
  const subject = "New visit confirmed";
  const intro = "A visit is confirmed.";
  const petLine = pets
    .map((pet) => `${pet.petName} · ${pet.serviceName}`)
    .join("; ");
  const rows = [
    { label: "Customer", value: facts.customerName || "Customer" },
    { label: "Dogs", value: petLine || "the visit" },
    { label: "When", value: facts.whenLabel },
    { label: "Address", value: facts.addressLabel },
  ];
  const text = [
    intro,
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    "",
    `Calendar: ${siteUrl("/admin/appointments")}`,
  ].join("\n");
  const letter = buildStaffNotificationEmail(
    {
      subject,
      introHtml: `<p style="margin:0 0 16px; font-size:15px;">${intro}</p>`,
      rows,
      cta: { href: siteUrl("/admin/appointments"), label: "VIEW CALENDAR" },
    },
    text,
  );
  return {
    subject,
    emailText: letter.text,
    emailHtml: letter.html,
    sms: `K9 Atelier: New visit confirmed for ${joinPetNames(pets.map((pet) => pet.petName))} on ${facts.whenLabel}. ${facts.addressLabel}`,
  };
}

function noticeScope(visitId: string | null, appointmentId: string) {
  return visitId
    ? communicationVisitScope(visitId)
    : communicationAppointmentScope(appointmentId);
}

function channelKey(facts: MerchantVisitFacts, channel: "email" | "sms") {
  const appointmentId = activePets(facts.pets)[0]?.appointmentId ?? facts.pets[0]?.appointmentId;
  if (!appointmentId) return null;
  return communicationIdempotencyKey({
    channel,
    notificationType: MERCHANT_VISIT_CONFIRMED,
    audience: "staff",
    scope: noticeScope(facts.visitId, appointmentId),
    fingerprint: "-",
  });
}

async function sendChannel(input: {
  store: CommunicationClaimStore;
  facts: MerchantVisitFacts;
  channel: "email" | "sms";
  recipient: string;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  replyTo: string | null;
  skip: "missing_config" | "invalid_recipient" | null;
  send?: () => Promise<ProviderAttempt>;
  now?: number;
}) {
  const pets = activePets(input.facts.pets);
  const idempotencyKey = channelKey(input.facts, input.channel);
  if (!idempotencyKey) return "unrecorded" as const;
  return deliverTrackedNotice({
    store: input.store,
    now: input.now,
    skip: input.skip,
    snapshot: {
      channel: input.channel,
      provider: input.channel === "email" ? "resend" : "twilio",
      notificationType: MERCHANT_VISIT_CONFIRMED,
      audience: "staff",
      customerId: input.facts.customerId,
      visitId: input.facts.visitId,
      appointmentIds: pets.map((pet) => pet.appointmentId),
      petIds: pets.map((pet) => pet.petId),
      recipient: input.recipient,
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      replyTo: input.replyTo,
      idempotencyKey,
    },
    send: input.skip ? undefined : input.send,
  });
}

export async function notifyMerchantVisitConfirmed(
  facts: MerchantVisitFacts,
  deps: {
    store: CommunicationClaimStore;
    now?: number;
    env?: MerchantEnv;
    sendEmail?: (input: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
      replyTo?: string | null;
    }) => Promise<ProviderAttempt>;
    sendSms?: (input: { to: string; body: string }) => Promise<ProviderAttempt>;
  },
): Promise<MerchantNotifySummary> {
  if (!merchantVisitIsConfirmed(facts.pets)) {
    return { email: "not_confirmed", sms: "not_confirmed" };
  }
  const copy = buildMerchantVisitConfirmedCopy(facts);
  const from = readMerchantFromAddress(deps.env);
  const phone = readMerchantNotifyPhone(deps.env);
  const emailSkip = from.ok ? null : from.reason;
  const smsSkip = phone ? null : ("missing_config" as const);
  const email = await sendChannel({
    store: deps.store,
    facts,
    channel: "email",
    recipient: MERCHANT_NOTIFY_EMAIL,
    subject: copy.subject,
    bodyText: copy.emailText,
    bodyHtml: copy.emailHtml,
    replyTo: facts.replyTo,
    skip: emailSkip,
    now: deps.now,
    send:
      from.ok
        ? () =>
            deps.sendEmail
              ? deps.sendEmail({
                  from: from.from,
                  to: MERCHANT_NOTIFY_EMAIL,
                  subject: copy.subject,
                  text: copy.emailText,
                  html: copy.emailHtml,
                  replyTo: facts.replyTo,
                })
              : sendTrackedEmail({
                  from: from.from,
                  to: MERCHANT_NOTIFY_EMAIL,
                  subject: copy.subject,
                  text: copy.emailText,
                  html: copy.emailHtml,
                  replyTo: facts.replyTo,
                }).then((result) => {
                  if (result.outcome === "skipped") {
                    return { outcome: "uncertain" as const, error: "missing_config" };
                  }
                  return result;
                })
        : undefined,
  });
  const sms = await sendChannel({
    store: deps.store,
    facts,
    channel: "sms",
    recipient: phone ?? "missing",
    subject: null,
    bodyText: copy.sms,
    bodyHtml: null,
    replyTo: null,
    skip: smsSkip,
    now: deps.now,
    send: phone
      ? () =>
          deps.sendSms
            ? deps.sendSms({ to: phone, body: copy.sms })
            : sendTrackedSms({ to: phone, body: copy.sms }).then((result) => {
                if (result.outcome === "skipped") {
                  return { outcome: "uncertain" as const, error: "missing_config" };
                }
                return result;
              })
      : undefined,
  });
  return { email, sms };
}

const SELF_BOOK_SELECT = `
  id,
  customer_id,
  pet_id,
  service_id,
  service_name,
  add_on_ids,
  add_on_options,
  address_street,
  address_city,
  address_state,
  address_zip,
  travel_distance_miles,
  travel_fee,
  appointment_date,
  appointment_time,
  scheduled_start,
  visit_id,
  timezone,
  estimated_total,
  new_client_deposit,
  vaccination_status_at_booking,
  status,
  confirmed_at,
  customer_confirmed_at,
  created_at,
  pets ( name, breed ),
  profiles ( email, first_name, last_name, phone )
`;

/**
 * One owner notice after every non-cancelled dog is confirmed.
 * A historical appointment with no visit uses its own appointment key.
 * Does not call notifyStaffNewAppointment.
 */
export async function notifyMerchantSelfBooking(appointmentId: string) {
  if (!hasSupabaseAdminConfig()) {
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  const admin = createAdminClient();
  const seed = await admin
    .from("appointments")
    .select("visit_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (seed.error || !seed.data) {
    console.error(
      "merchant self-booking visit missing:",
      appointmentId,
      seed.error?.message,
    );
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  const loaded = seed.data.visit_id
    ? await admin.from("appointments").select(SELF_BOOK_SELECT).eq("visit_id", seed.data.visit_id)
    : await admin.from("appointments").select(SELF_BOOK_SELECT).eq("id", appointmentId);
  if (loaded.error) {
    console.error("merchant self-booking visit load failed:", loaded.error.message);
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  const rows = (loaded.data ?? []) as unknown as AppointmentRow[];
  const appointments = rows.map(mapAppointmentRowToRecord);
  if (!merchantVisitIsConfirmed(appointments)) {
    return { email: "not_confirmed" as const, sms: "not_confirmed" as const };
  }
  const profile = rows
    .map((row) => {
      const value = row.profiles;
      if (!value) return null;
      return Array.isArray(value) ? value[0] : value;
    })
    .find(Boolean);
  return notifyMerchantVisitConfirmedFromAppointments(
    appointments,
    {
      customerName: [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || null,
      replyTo: profile?.email ?? null,
    },
    { store: createSupabaseClaimStore(admin) },
  );
}

export async function notifyMerchantVisitConfirmedFromAppointments(
  appointments: AppointmentRecord[],
  extra: { customerName?: string | null; replyTo?: string | null } | undefined,
  deps: Parameters<typeof notifyMerchantVisitConfirmed>[1],
) {
  const facts = factsFromAppointments(appointments, extra);
  if (!facts) return { email: "unrecorded" as const, sms: "unrecorded" as const };
  return notifyMerchantVisitConfirmed(facts, deps);
}

export type MerchantAppointmentNotice = {
  visitId: string | null;
  appointmentId: string;
  customerId: string | null;
  petId: string | null;
  customerName: string | null;
  replyTo: string | null;
  petName: string;
  serviceName: string;
  whenLabel: string;
  addressLabel: string;
  replyText?: string | null;
};

type MerchantSendDeps = {
  store: CommunicationClaimStore;
  now?: number;
  env?: MerchantEnv;
  sendEmail?: Parameters<typeof notifyMerchantVisitConfirmed>[1]["sendEmail"];
  sendSms?: Parameters<typeof notifyMerchantVisitConfirmed>[1]["sendSms"];
};

function staffLetter(input: {
  subject: string;
  intro: string;
  rows: Array<{ label: string; value: string }>;
  note?: string;
}) {
  const text = [
    input.intro,
    "",
    ...input.rows.map((row) => `${row.label}: ${row.value}`),
    "",
    input.note ?? `Calendar: ${siteUrl("/admin/appointments")}`,
  ].join("\n");
  const letter = buildStaffNotificationEmail(
    {
      subject: input.subject,
      introHtml: `<p style="margin:0 0 16px; font-size:15px;">${escapeHtml(input.intro)}</p>`,
      rows: input.rows,
      cta: { href: siteUrl("/admin/appointments"), label: "VIEW CALENDAR" },
    },
    text,
  );
  return { text: letter.text, html: letter.html };
}

async function deliverStaffChannel(input: {
  deps: MerchantSendDeps;
  channel: "email" | "sms";
  notificationType: string;
  notice: MerchantAppointmentNotice;
  fingerprint: string;
  recipient: string;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  skip: "missing_config" | "invalid_recipient" | null;
  send?: () => Promise<ProviderAttempt>;
}) {
  return deliverTrackedNotice({
    store: input.deps.store,
    now: input.deps.now,
    skip: input.skip,
    snapshot: {
      channel: input.channel,
      provider: input.channel === "email" ? "resend" : "twilio",
      notificationType: input.notificationType,
      audience: "staff",
      customerId: input.notice.customerId,
      visitId: input.notice.visitId,
      appointmentIds: [input.notice.appointmentId],
      petIds: input.notice.petId ? [input.notice.petId] : [],
      recipient: input.recipient,
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      replyTo: input.notice.replyTo,
      idempotencyKey: communicationIdempotencyKey({
        channel: input.channel,
        notificationType: input.notificationType,
        audience: "staff",
        scope: noticeScope(input.notice.visitId, input.notice.appointmentId),
        fingerprint: input.fingerprint,
      }),
    },
    send: input.skip ? undefined : input.send,
  });
}

function merchantEmailSend(
  deps: MerchantSendDeps,
  from: string,
  message: {
    subject: string;
    text: string;
    html: string;
    replyTo: string | null;
  },
) {
  return () =>
    deps.sendEmail
      ? deps.sendEmail({
          from,
          to: MERCHANT_NOTIFY_EMAIL,
          subject: message.subject,
          text: message.text,
          html: message.html,
          replyTo: message.replyTo,
        })
      : sendTrackedEmail({
          from,
          to: MERCHANT_NOTIFY_EMAIL,
          subject: message.subject,
          text: message.text,
          html: message.html,
          replyTo: message.replyTo,
        }).then((result) => {
          if (result.outcome === "skipped") {
            return { outcome: "uncertain" as const, error: "missing_config" };
          }
          return result;
        });
}

function merchantSmsSend(deps: MerchantSendDeps, phone: string, body: string) {
  return () =>
    deps.sendSms
      ? deps.sendSms({ to: phone, body })
      : sendTrackedSms({ to: phone, body }).then((result) => {
          if (result.outcome === "skipped") {
            return { outcome: "uncertain" as const, error: "missing_config" };
          }
          return result;
        });
}

/**
 * The customer's first C / YES. Email only, once per appointment.
 * This replaces the untracked owner email. It is not merchant_visit_confirmed.
 */
export async function notifyMerchantCustomerReplyC(
  notice: MerchantAppointmentNotice,
  deps: MerchantSendDeps,
): Promise<DeliveryOutcome> {
  const subject = `Customer confirmed — ${notice.petName}`;
  const intro = `${notice.customerName || "A customer"} replied ${notice.replyText?.trim() || "C"} to confirm.`;
  const letter = staffLetter({
    subject,
    intro,
    rows: [
      { label: "Pet", value: notice.petName },
      { label: "Service", value: notice.serviceName },
      { label: "When", value: notice.whenLabel },
      { label: "Address", value: notice.addressLabel || "—" },
    ],
    note: "This is the customer SMS confirmation. It does not change staff booking status.",
  });
  const from = readMerchantFromAddress(deps.env);
  return deliverStaffChannel({
    deps,
    channel: "email",
    notificationType: MERCHANT_CUSTOMER_REPLY_C,
    notice,
    fingerprint: notice.appointmentId,
    recipient: MERCHANT_NOTIFY_EMAIL,
    subject,
    bodyText: letter.text,
    bodyHtml: letter.html,
    skip: from.ok ? null : from.reason,
    send: from.ok
      ? merchantEmailSend(deps, from.from, {
          subject,
          text: letter.text,
          html: letter.html,
          replyTo: notice.replyTo,
        })
      : undefined,
  });
}

/**
 * One owner notice for the dog just added. Distinct from the visit-confirmed key,
 * so the original booking notice is not sent again and this add is not dropped.
 */
export async function notifyMerchantPetAdded(
  notice: MerchantAppointmentNotice,
  deps: MerchantSendDeps,
): Promise<MerchantNotifySummary> {
  const subject = "Dog added to a visit";
  const intro = `${notice.petName} was added to a visit.`;
  const letter = staffLetter({
    subject,
    intro,
    rows: [
      { label: "Customer", value: notice.customerName || "Customer" },
      { label: "Dog", value: `${notice.petName} · ${notice.serviceName}` },
      { label: "When", value: notice.whenLabel },
      { label: "Address", value: notice.addressLabel || "—" },
    ],
  });
  const sms = `K9 Atelier: ${notice.petName} was added to the visit on ${notice.whenLabel}. ${notice.addressLabel}`.trim();
  const from = readMerchantFromAddress(deps.env);
  const phone = readMerchantNotifyPhone(deps.env);
  const email = await deliverStaffChannel({
    deps,
    channel: "email",
    notificationType: MERCHANT_VISIT_PET_ADDED,
    notice,
    fingerprint: notice.appointmentId,
    recipient: MERCHANT_NOTIFY_EMAIL,
    subject,
    bodyText: letter.text,
    bodyHtml: letter.html,
    skip: from.ok ? null : from.reason,
    send: from.ok
      ? merchantEmailSend(deps, from.from, {
          subject,
          text: letter.text,
          html: letter.html,
          replyTo: notice.replyTo,
        })
      : undefined,
  });
  const smsOutcome = await deliverStaffChannel({
    deps,
    channel: "sms",
    notificationType: MERCHANT_VISIT_PET_ADDED,
    notice,
    fingerprint: notice.appointmentId,
    recipient: phone ?? "missing",
    subject: null,
    bodyText: sms,
    bodyHtml: null,
    skip: phone ? null : "missing_config",
    send: phone ? merchantSmsSend(deps, phone, sms) : undefined,
  });
  return { email, sms: smsOutcome };
}

export function merchantNoticeFromAppointment(
  appointment: AppointmentRecord,
  customer: { name?: string | null; email?: string | null },
  replyText?: string | null,
): MerchantAppointmentNotice {
  return {
    visitId: appointment.visitId ?? null,
    appointmentId: appointment.id,
    customerId: appointment.customerId,
    petId: appointment.petId,
    customerName: customer.name ?? null,
    replyTo: customer.email ?? null,
    petName: appointment.petName,
    serviceName: appointment.serviceName,
    whenLabel: `${formatAppointmentDateLabel(appointment.appointmentDate)}, ${appointment.appointmentTime ?? ""}`.trim(),
    addressLabel: [
      appointment.addressStreet,
      appointment.addressCity,
      appointment.addressState,
      appointment.addressZip,
    ]
      .filter(Boolean)
      .join(", "),
    replyText,
  };
}

export async function notifyMerchantPetAddedForAppointment(
  appointment: AppointmentRecord,
  customer: { name?: string | null; email?: string | null },
) {
  if (!hasSupabaseAdminConfig()) {
    return { email: "unrecorded" as const, sms: "unrecorded" as const };
  }
  return notifyMerchantPetAdded(merchantNoticeFromAppointment(appointment, customer), {
    store: createSupabaseClaimStore(createAdminClient()),
  });
}

/**
 * Replay only rows decideClaim still allows: failed, or skipped missing_config.
 * Uncertain, pending, and accepted rows are not listed and are not sent again.
 * The stored snapshot is what gets sent. A new template is not composed.
 */
export async function replayMerchantVisitConfirmed(deps: {
  store: CommunicationClaimStore;
  now?: number;
  env?: MerchantEnv;
  sendEmail?: Parameters<typeof notifyMerchantVisitConfirmed>[1]["sendEmail"];
  sendSms?: Parameters<typeof notifyMerchantVisitConfirmed>[1]["sendSms"];
}) {
  const listed = await Promise.all(
    MERCHANT_REPLAY_TYPES.map((notificationType) => deps.store.listRetryable(notificationType)),
  );
  const rows = listed.flat();
  const from = readMerchantFromAddress(deps.env);
  const phone = readMerchantNotifyPhone(deps.env);
  let retried = 0;
  let held = 0;
  for (const row of rows) {
    const email = row.snapshot.channel === "email";
    const skip = email ? (from.ok ? null : from.reason) : phone ? null : ("missing_config" as const);
    const outcome = await deliverTrackedNotice({
      store: deps.store,
      snapshot: row.snapshot,
      now: deps.now,
      skip,
      send: skip
        ? undefined
        : async () => {
            if (email) {
              if (!from.ok) {
                return { outcome: "uncertain" as const, error: "missing_config" };
              }
              const message = {
                from: from.from,
                to: row.snapshot.recipient,
                subject: row.snapshot.subject ?? "New visit confirmed",
                text: row.snapshot.bodyText,
                html: row.snapshot.bodyHtml ?? "",
                replyTo: row.snapshot.replyTo,
              };
              if (deps.sendEmail) return deps.sendEmail(message);
              const result = await sendTrackedEmail(message);
              if (result.outcome === "skipped") {
                return { outcome: "uncertain" as const, error: "missing_config" };
              }
              return result;
            }
            const message = { to: phone ?? row.snapshot.recipient, body: row.snapshot.bodyText };
            if (deps.sendSms) return deps.sendSms(message);
            const result = await sendTrackedSms(message);
            if (result.outcome === "skipped") {
              return { outcome: "uncertain" as const, error: "missing_config" };
            }
            return result;
          },
    });
    if (outcome === "accepted" || outcome === "failed") retried += 1;
    else held += 1;
  }
  return { retried, held };
}

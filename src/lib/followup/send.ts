import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import {
  FOLLOW_UP_CLAIM_LEASE_MS,
  followUpClaimOrFilter,
  type FollowUpChannel,
} from "@/lib/followup/claim";
import {
  deliverHouseholdFollowUps,
  type FollowUpClaimResult,
  type FollowUpStore,
} from "@/lib/followup/deliver";
import type { FollowUpCharge, FollowUpPet } from "@/lib/followup/eligibility";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";

const FOLLOW_UP_SELECT = `
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
  timezone,
  estimated_total,
  new_client_deposit,
  vaccination_status_at_booking,
  status,
  confirmed_at,
  customer_confirmed_at,
  created_at,
  service_ended_at,
  followup_sent_at,
  followup_email_sent_at,
  followup_sms_sent_at,
  followup_email_claimed_at,
  followup_sms_claimed_at,
  pets ( name ),
  profiles ( email, first_name, last_name, phone )
`;

type FollowUpRow = {
  id: string;
  customer_id: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  appointment_date: string;
  status: string;
  service_ended_at: string | null;
  followup_email_sent_at: string | null;
  followup_sms_sent_at: string | null;
  followup_email_claimed_at: string | null;
  followup_sms_claimed_at: string | null;
  pets?: { name: string | null } | { name: string | null }[] | null;
  profiles?:
    | {
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
      }
    | {
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
      }[]
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapFollowUpPet(row: FollowUpRow): FollowUpPet {
  const pet = firstRelation(row.pets);
  const profile = firstRelation(row.profiles);
  return {
    id: row.id,
    customerId: row.customer_id,
    petName: pet?.name?.trim() || "",
    customerFirstName: profile?.first_name ?? null,
    customerLastName: profile?.last_name ?? null,
    customerEmail: profile?.email ?? "",
    customerPhone: profile?.phone ?? null,
    appointmentDate: row.appointment_date,
    addressStreet: row.address_street,
    addressCity: row.address_city,
    addressState: row.address_state,
    addressZip: row.address_zip,
    status: row.status,
    serviceEndedAt: row.service_ended_at,
    followupEmailSentAt: row.followup_email_sent_at,
    followupSmsSentAt: row.followup_sms_sent_at,
    followupEmailClaimedAt: row.followup_email_claimed_at,
    followupSmsClaimedAt: row.followup_sms_claimed_at,
  };
}

function channelColumns(channel: FollowUpChannel) {
  if (channel === "email") {
    return {
      sent: "followup_email_sent_at",
      claim: "followup_email_claimed_at" as const,
    };
  }
  return {
    sent: "followup_sms_sent_at",
    claim: "followup_sms_claimed_at" as const,
  };
}

function createFollowUpStore(): FollowUpStore {
  const admin = createAdminClient();

  return {
    async listCompletedInWindow(start, end) {
      const { data, error } = await admin
        .from("appointments")
        .select(FOLLOW_UP_SELECT)
        .gte("appointment_date", start)
        .lte("appointment_date", end)
        .not("service_ended_at", "is", null);
      if (error) {
        console.error("sendNextDayFollowUp lookup failed:", error.message);
        return null;
      }
      return ((data ?? []) as unknown as FollowUpRow[]).map(mapFollowUpPet);
    },

    async listCharges(appointmentIds) {
      if (appointmentIds.length === 0) return [];
      const { data, error } = await admin
        .from("appointment_charges")
        .select("appointment_id, kind, status, total, refunded_amount")
        .in("appointment_id", appointmentIds);
      if (error) {
        console.error("sendNextDayFollowUp charge lookup failed:", error.message);
        return null;
      }
      return (data ?? []).map(
        (row) =>
          ({
            appointmentId: row.appointment_id as string,
            kind: row.kind as string,
            status: row.status as string,
            total: Number(row.total ?? 0),
            refundedAmount: Number(row.refunded_amount ?? 0),
          }) satisfies FollowUpCharge,
      );
    },

    async claimChannel(ids, channel, now) {
      if (ids.length === 0) return { status: "busy" };
      const columns = channelColumns(channel);
      const claimAt = now.toISOString();
      const leaseBefore = new Date(now.getTime() - FOLLOW_UP_CLAIM_LEASE_MS);
      const { data, error } = await admin
        .from("appointments")
        .update({ [columns.claim]: claimAt })
        .in("id", ids)
        .is(columns.sent, null)
        .or(followUpClaimOrFilter(columns.claim, leaseBefore))
        .select("id");
      if (error) {
        console.error("sendNextDayFollowUp claim failed:", error.message);
        return { status: "busy" };
      }

      const claimed = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
      if (claimed.length === ids.length) {
        return { status: "claimed", claimAt } satisfies FollowUpClaimResult;
      }

      const { data: current, error: readError } = await admin
        .from("appointments")
        .select("id, followup_email_sent_at, followup_sms_sent_at")
        .in("id", ids);
      if (readError || !current) {
        if (claimed.length > 0) {
          await admin
            .from("appointments")
            .update({ [columns.claim]: null })
            .in("id", claimed)
            .eq(columns.claim, claimAt);
        }
        console.error(
          "sendNextDayFollowUp claim reread failed:",
          readError?.message,
        );
        return { status: "busy" };
      }

      const sentAt = current
        .map((row) =>
          channel === "email"
            ? row.followup_email_sent_at
            : row.followup_sms_sent_at,
        )
        .find((value): value is string => Boolean(value));
      if (!sentAt) {
        if (claimed.length > 0) {
          await admin
            .from("appointments")
            .update({ [columns.claim]: null })
            .in("id", claimed)
            .eq(columns.claim, claimAt)
            .is(columns.sent, null);
        }
        return { status: "busy" };
      }
      if (claimed.length > 0) {
        await admin
          .from("appointments")
          .update({ [columns.sent]: sentAt, [columns.claim]: null })
          .in("id", claimed)
          .eq(columns.claim, claimAt)
          .is(columns.sent, null);
      }
      await admin
        .from("appointments")
        .update({ [columns.sent]: sentAt, [columns.claim]: null })
        .in("id", ids)
        .is(columns.sent, null)
        .or(followUpClaimOrFilter(columns.claim, leaseBefore));
      await stampHouseholdFollowUp(admin, ids, sentAt);
      return { status: "already_sent" };
    },

    async markChannelSent(ids, channel, sentAt, claimAt) {
      const columns = channelColumns(channel);
      const { data, error } = await admin
        .from("appointments")
        .update({ [columns.sent]: sentAt, [columns.claim]: null })
        .in("id", ids)
        .eq(columns.claim, claimAt)
        .is(columns.sent, null)
        .select("id");
      if (error) {
        console.error("sendNextDayFollowUp mark failed:", error.message);
        return false;
      }
      if (!data || data.length === 0) return false;
      await stampHouseholdFollowUp(admin, ids, sentAt);
      return true;
    },

    async releaseClaim(ids, channel, claimAt) {
      const columns = channelColumns(channel);
      const { error } = await admin
        .from("appointments")
        .update({ [columns.claim]: null })
        .in("id", ids)
        .eq(columns.claim, claimAt)
        .is(columns.sent, null);
      if (error) {
        console.error("sendNextDayFollowUp release failed:", error.message);
      }
    },
  };
}

async function stampHouseholdFollowUp(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
  sentAt: string,
) {
  const { error } = await admin
    .from("appointments")
    .update({ followup_sent_at: sentAt })
    .in("id", ids)
    .is("followup_sent_at", null)
    .not("followup_email_sent_at", "is", null)
    .not("followup_sms_sent_at", "is", null);
  if (error) {
    console.error("sendNextDayFollowUp household stamp failed:", error.message);
  }
}

export async function sendNextDayFollowUp(now = new Date()) {
  if (!hasSupabaseAdminConfig()) {
    return { sent: 0, skipped: 0, failed: 0, reason: "supabase_admin_missing" };
  }

  return deliverHouseholdFollowUps({
    now,
    store: createFollowUpStore(),
    isEmailConfigured: isEmailConfigured(),
    isSmsConfigured: isSmsConfigured(),
    sendEmail: (input) => sendEmail(input),
    sendSms: (input) => sendSms(input),
    recordSms: async (input) => {
      await recordCustomerSms({
        direction: "outbound",
        phone: input.phone,
        body: input.body,
        customerId: input.customerId,
        customerName: input.customerName,
        petNames: input.petNames,
      });
    },
    normalizePhone: normalizePhoneToE164,
  });
}

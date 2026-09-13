import {
  mapAppointmentRowToRecord,
} from "@/lib/appointments/map";
import type {
  AppointmentRecord,
  AppointmentRow,
} from "@/lib/appointments/types";
import { isFrozenAuthUser } from "@/lib/auth/frozen-account";
import { fetchCustomerContact } from "@/lib/email/appointment-context";
import { notifyCustomerAppointmentConfirmed } from "@/lib/email/appointment-mails";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import {
  hashCustomerConfirmToken,
  isCustomerConfirmExpired,
} from "@/lib/staff/customer-confirm-token";

const APPOINTMENT_SELECT = `
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
  time_preference,
  address_lat,
  address_lon,
  timezone,
  estimated_total,
  new_client_deposit,
  vaccination_status_at_booking,
  status,
  confirmed_at,
  customer_confirmed_at,
  staff_created,
  customer_confirm_token_hash,
  customer_confirm_expires_at,
  created_at,
  pets ( name, breed )
`;

export type CustomerConfirmPreview = {
  appointment: AppointmentRecord;
  customer: {
    email: string;
    firstName: string;
  };
  requiresPassword: boolean;
  createdAccount: boolean;
};

async function loadConfirmAppointment(token: string) {
  if (!hasSupabaseAdminConfig()) {
    return { ok: false as const, error: "misconfigured" as const };
  }

  const admin = createAdminClient();
  const hash = hashCustomerConfirmToken(token);
  const { data, error } = await admin
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("customer_confirm_token_hash", hash)
    .maybeSingle();

  if (error) {
    console.error("loadConfirmAppointment failed:", error.message);
    return { ok: false as const, error: "server" as const };
  }
  if (!data) return { ok: false as const, error: "not_found" as const };

  const row = data as AppointmentRow;
  if (row.status === "cancelled") {
    return { ok: false as const, error: "not_found" as const };
  }
  if (isCustomerConfirmExpired(row.customer_confirm_expires_at)) {
    return { ok: false as const, error: "expired" as const };
  }

  const { data: authUser, error: authError } =
    await admin.auth.admin.getUserById(row.customer_id);
  if (authError || !authUser.user) {
    console.error("loadConfirmAppointment user failed:", authError?.message);
    return { ok: false as const, error: "server" as const };
  }
  if (isFrozenAuthUser(authUser.user)) {
    return { ok: false as const, error: "frozen" as const };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, first_name")
    .eq("id", row.customer_id)
    .maybeSingle();

  const appointment = mapAppointmentRowToRecord(row);
  const requiresPassword = authUser.user.app_metadata?.unclaimed === true;

  return {
    ok: true as const,
    admin,
    row,
    appointment,
    user: authUser.user,
    requiresPassword,
    email: profile?.email ?? authUser.user.email ?? "",
    firstName: profile?.first_name ?? "",
  };
}

export async function getCustomerConfirmPreview(
  token: string,
): Promise<
  | { preview: CustomerConfirmPreview }
  | { error: "not_found" | "expired" | "frozen" | "misconfigured" | "server" }
> {
  const result = await loadConfirmAppointment(token);
  if (!result.ok) return result;

  return {
    preview: {
      appointment: result.appointment,
      customer: {
        email: result.email,
        firstName: result.firstName,
      },
      requiresPassword: result.requiresPassword,
      createdAccount: result.user.app_metadata?.staff_created === true,
    },
  };
}

export async function confirmStaffCreatedBooking(input: {
  token: string;
  password: string | null;
}): Promise<
  | {
      appointment: AppointmentRecord;
      email: string;
      signedInWithPassword: boolean;
    }
  | {
      error:
        | "not_found"
        | "expired"
        | "frozen"
        | "conflict"
        | "misconfigured"
        | "server";
      message?: string;
    }
> {
  const result = await loadConfirmAppointment(input.token);
  if (!result.ok) return result;

  if (result.requiresPassword && !input.password) {
    return {
      error: "conflict",
      message: "Set a password to finish creating this account.",
    };
  }

  if (input.password) {
    const { error } = await result.admin.auth.admin.updateUserById(
      result.user.id,
      {
        password: input.password,
        app_metadata: {
          ...result.user.app_metadata,
          unclaimed: false,
        },
      },
    );
    if (error) {
      console.error("confirmStaffCreatedBooking password failed:", error.message);
      return { error: "server" };
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await result.admin
    .from("appointments")
    .update({
      status: "confirmed",
      confirmed_at: now,
      customer_confirmed_at: now,
      customer_confirm_token_hash: null,
      customer_confirm_expires_at: null,
    })
    .eq("id", result.appointment.id)
    .eq("customer_confirm_token_hash", hashCustomerConfirmToken(input.token))
    .select(APPOINTMENT_SELECT)
    .maybeSingle();

  if (error) {
    console.error("confirmStaffCreatedBooking update failed:", error.message);
    return { error: "server" };
  }
  if (!data) {
    return { error: "not_found" };
  }

  const appointment = mapAppointmentRowToRecord(data as AppointmentRow);
  try {
    const contact =
      (await fetchCustomerContact(result.user.id)) ??
      (result.email
        ? { email: result.email, name: result.firstName || null }
        : null);
    if (contact) {
      await notifyCustomerAppointmentConfirmed(appointment, contact);
    }
  } catch (emailError) {
    console.error("confirmStaffCreatedBooking email failed:", emailError);
  }

  return {
    appointment,
    email: result.email,
    signedInWithPassword: Boolean(input.password),
  };
}

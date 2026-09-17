import { business } from "@/lib/business";
import {
  assignArrivalWindow,
  claimDayPlan,
  getBaseGeoPoint,
} from "@/lib/appointments/schedule";
import {
  mapAppointmentRowToRecord,
} from "@/lib/appointments/map";
import type {
  AppointmentRecord,
  AppointmentRow,
} from "@/lib/appointments/types";
import { drivingDistanceMiles, geocodeAddress } from "@/lib/geo";
import { getBaseAddressFormatted } from "@/lib/server/base-address";
import { formatServiceAddress, calculateTravelFee } from "@/lib/travel";
import { mapValidatedInputToInsertRow } from "@/lib/pets/map";
import { PET_SELECT } from "@/lib/pets/types";
import {
  estimateServiceDurationMinutes,
  getServicePriceEstimate,
  allBookableServices,
} from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { getStaffSession } from "@/lib/staff/auth";
import { isOwnerEmail, normalizeStaffEmail } from "@/lib/staff/owner";
import { isFrozenAuthUser } from "@/lib/auth/frozen-account";
import { isEmailConfigured, sendEmail, siteUrl } from "@/lib/email/resend";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import type { StaffCustomerBookingInput } from "@/lib/staff/create-customer-booking-input";
import {
  createCustomerConfirmToken,
  customerConfirmExpiryIso,
  customerConfirmPath,
} from "@/lib/staff/customer-confirm-token";
import {
  buildStaffCreatedBookingEmail,
  buildStaffCreatedBookingSms,
} from "@/lib/staff/customer-booking-copy";

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

export type StaffCreatedBookingResult = {
  appointment: AppointmentRecord;
  customer: {
    id: string;
    email: string;
    firstName: string;
    createdAccount: boolean;
  };
  confirmUrl: string;
  emailed: boolean;
  texted: boolean;
};

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const normalized = normalizeStaffEmail(email);
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error("findAuthUserByEmail failed:", error.message);
      return { error: "server" as const };
    }
    const match = data.users.find(
      (user) => user.email && normalizeStaffEmail(user.email) === normalized,
    );
    if (match) return { user: match };
    if (data.users.length < 200) return { user: null };
    page += 1;
  }
  return { user: null };
}

async function isStaffAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string,
) {
  if (isOwnerEmail(email)) return true;
  const { data } = await admin
    .schema("private")
    .from("staff_members")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function createStaffCustomerBooking(
  input: StaffCustomerBookingInput,
): Promise<
  | { booking: StaffCreatedBookingResult }
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "conflict"
        | "slot_unavailable"
        | "outside_area"
        | "misconfigured"
        | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  if (!hasSupabaseAdminConfig()) return { error: "misconfigured" };

  const baseFormatted = getBaseAddressFormatted();
  const base = await getBaseGeoPoint();
  if (!baseFormatted || !base) return { error: "misconfigured" };

  const customerQuery = formatServiceAddress(input.address);
  const destination = await geocodeAddress(customerQuery);
  if (!destination) {
    return {
      error: "outside_area",
      message:
        "We could not locate that address. Please check the street and ZIP code.",
    };
  }

  const miles = await drivingDistanceMiles(base, destination);
  if (miles == null) return { error: "server" };

  const quote = calculateTravelFee(miles);
  if (!quote.withinServiceArea) {
    return {
      error: "outside_area",
      message: quote.summary,
    };
  }

  const service = allBookableServices().find(
    (entry) => entry.id === input.serviceId,
  );
  if (!service) return { error: "conflict", message: "Unknown service." };

  const price = getServicePriceEstimate(service, input.pet.weightLbs);
  const estimatedTotal =
    Math.round(((price?.from ?? 0) + quote.fee) * 100) / 100;

  const durationMinutes = estimateServiceDurationMinutes(
    input.serviceId,
    input.pet.weightLbs,
    input.addOnIds,
  );
  const assignment = await assignArrivalWindow({
    date: input.appointmentDate,
    point: destination,
    zip: input.address.zip,
    durationMinutes,
    slotStartMinutes: input.slotStartMinutes,
    base,
  });
  if ("error" in assignment) {
    if (assignment.error === "slot_unavailable") {
      return { error: "slot_unavailable" };
    }
    if (assignment.error === "misconfigured") return { error: "misconfigured" };
    return { error: "server" };
  }

  const claimed = await claimDayPlan(
    input.appointmentDate,
    input.address.zip,
    destination,
  );
  if ("error" in claimed) {
    if (claimed.error === "slot_unavailable") return { error: "slot_unavailable" };
    if (claimed.error === "misconfigured") return { error: "misconfigured" };
    return { error: "server" };
  }

  try {
    const admin = createAdminClient();
    const existing = await findAuthUserByEmail(admin, input.email);
    if ("error" in existing) return { error: "server" };

    let userId: string;
    let createdAccount = false;

    if (existing.user) {
      if (isFrozenAuthUser(existing.user)) {
        return {
          error: "conflict",
          message: "That customer account is frozen. Unfreeze it before booking.",
        };
      }
      if (await isStaffAccount(admin, existing.user.id, input.email)) {
        return {
          error: "conflict",
          message: "That email belongs to a staff account.",
        };
      }
      userId = existing.user.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        email_confirm: true,
        user_metadata: {
          first_name: input.firstName,
          last_name: input.lastName,
          phone: input.phone,
        },
        app_metadata: {
          staff_created: true,
          unclaimed: true,
        },
      });
      if (error || !data.user) {
        console.error("createStaffCustomerBooking createUser failed:", error?.message);
        return { error: "server" };
      }
      userId = data.user.id;
      createdAccount = true;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
      })
      .eq("id", userId);
    if (profileError) {
      console.error(
        "createStaffCustomerBooking profile update failed:",
        profileError.message,
      );
      return { error: "server" };
    }

    const { data: petRow, error: petError } = await admin
      .from("pets")
      .insert({
        customer_id: userId,
        ...mapValidatedInputToInsertRow(input.pet),
      })
      .select(PET_SELECT)
      .single();

    if (petError || !petRow) {
      console.error(
        "createStaffCustomerBooking pet insert failed:",
        petError?.message,
      );
      return { error: "server" };
    }

    try {
      const { ensurePetReferralCode } = await import("@/lib/referrals/service");
      await ensurePetReferralCode({
        petId: petRow.id as string,
        petName: input.pet.name,
        ownerCustomerId: userId,
      });
    } catch (error) {
      console.error("createStaffCustomerBooking referral code failed:", error);
    }

    const confirm = createCustomerConfirmToken();
    const { data: appointmentRow, error: appointmentError } = await admin
      .from("appointments")
      .insert({
        customer_id: userId,
        pet_id: petRow.id,
        service_id: input.serviceId,
        service_name: input.serviceName,
        add_on_ids: input.addOnIds,
        add_on_options: {},
        address_street: input.address.street,
        address_city: input.address.city,
        address_state: input.address.state,
        address_zip: input.address.zip,
        travel_distance_miles: quote.distanceMiles,
        travel_fee: quote.fee,
        appointment_date: input.appointmentDate,
        appointment_time: assignment.insertion.appointmentTime,
        scheduled_start: assignment.insertion.scheduledStart,
        time_preference: assignment.insertion.usedPreference,
        address_lat: destination.lat,
        address_lon: destination.lon,
        timezone: business.booking.timezone,
        estimated_total: estimatedTotal,
        new_client_deposit: 0,
        payment_method_id: null,
        vaccination_status_at_booking: "missing",
        status: "pending_confirmation",
        confirmed_at: null,
        staff_created: true,
        customer_confirm_token_hash: confirm.hash,
        customer_confirm_expires_at: customerConfirmExpiryIso(),
      })
      .select(APPOINTMENT_SELECT)
      .single();

    if (appointmentError || !appointmentRow) {
      console.error(
        "createStaffCustomerBooking appointment insert failed:",
        appointmentError?.code,
        appointmentError?.message,
      );
      if (appointmentError?.code === "23505") {
        return { error: "slot_unavailable" };
      }
      return { error: "server" };
    }

    const appointment = mapAppointmentRowToRecord(
      appointmentRow as AppointmentRow,
    );
    const confirmUrl = siteUrl(customerConfirmPath(confirm.token));

    let emailed = false;
    let texted = false;
    if (input.notifyEmail && isEmailConfigured()) {
      const email = buildStaffCreatedBookingEmail(appointment, {
        firstName: input.firstName,
        confirmUrl,
        createdAccount,
      });
      emailed = await sendEmail({
        to: input.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    }
    if (input.notifySms && isSmsConfigured()) {
      texted = await sendSms({
        to: input.phone,
        body: buildStaffCreatedBookingSms(appointment, confirmUrl),
      });
    }

    return {
      booking: {
        appointment,
        customer: {
          id: userId,
          email: input.email,
          firstName: input.firstName,
          createdAccount,
        },
        confirmUrl,
        emailed,
        texted,
      },
    };
  } catch (error) {
    console.error("createStaffCustomerBooking failed:", error);
    return { error: "server" };
  }
}

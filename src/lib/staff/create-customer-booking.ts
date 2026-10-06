import { business } from "@/lib/business";
import { resolveArrivalForBooking } from "@/lib/appointments/arrival-window";
import {
  assignArrivalWindow,
  claimDayPlan,
  getBaseGeoPoint,
} from "@/lib/appointments/schedule";
import { buildSameAddressCompanionInsertion } from "@/lib/booking-schedule";
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
import { keepPrimaryIfReferralFails } from "@/lib/referrals/allocate-code";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { getStaffSession } from "@/lib/staff/auth";
import { parseStaffServiceSelection } from "@/lib/staff/service-choice";
import { isOwnerEmail, normalizeStaffEmail } from "@/lib/staff/owner";
import { isFrozenAuthUser } from "@/lib/auth/frozen-account";
import { isEmailConfigured, sendEmail, siteUrl } from "@/lib/email/resend";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import { digitsOnly } from "@/lib/sms/phone";
import type {
  StaffBookingPetInput,
  StaffCustomerBookingInput,
} from "@/lib/staff/create-customer-booking-input";
import {
  createCustomerConfirmToken,
  customerConfirmExpiryIso,
  customerConfirmPath,
} from "@/lib/staff/customer-confirm-token";
import {
  buildStaffBookingInviteEmail,
  buildStaffBookingInviteSms,
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
  mode: "invite" | "booking";
  appointment: AppointmentRecord | null;
  customer: {
    id: string | null;
    email: string;
    firstName: string;
    createdAccount: boolean;
  };
  confirmUrl: string;
  emailed: boolean;
  texted: boolean;
};

function phonePlaceholderEmail(phone: string) {
  return `sms.${digitsOnly(phone)}@customers.k9atelier.com`;
}

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

async function findCustomerIdByPhone(
  admin: ReturnType<typeof createAdminClient>,
  phone: string,
) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("findCustomerIdByPhone failed:", error.message);
    return { error: "server" as const };
  }
  if (!data?.id) return { profile: null };
  return { profile: data as { id: string; email: string | null } };
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

async function resolveOrCreateCustomer(
  admin: ReturnType<typeof createAdminClient>,
  input: StaffCustomerBookingInput,
): Promise<
  | { userId: string; email: string; createdAccount: boolean }
  | { error: "conflict" | "server"; message?: string }
> {
  const accountEmail =
    input.email ?? (input.phone ? phonePlaceholderEmail(input.phone) : null);
  if (!accountEmail) {
    return { error: "conflict", message: "Enter a customer email or mobile phone." };
  }

  if (input.phone && !input.email) {
    const byPhone = await findCustomerIdByPhone(admin, input.phone);
    if ("error" in byPhone) return { error: "server" };
    if (byPhone.profile) {
      const { data: authUser, error } = await admin.auth.admin.getUserById(
        byPhone.profile.id,
      );
      if (error || !authUser.user) return { error: "server" };
      if (isFrozenAuthUser(authUser.user)) {
        return {
          error: "conflict",
          message: "That customer account is frozen. Unfreeze it before booking.",
        };
      }
      const profileEmail =
        byPhone.profile.email?.trim() ||
        authUser.user.email ||
        accountEmail;
      if (await isStaffAccount(admin, byPhone.profile.id, profileEmail)) {
        return {
          error: "conflict",
          message: "That phone belongs to a staff account.",
        };
      }
      return {
        userId: byPhone.profile.id,
        email: profileEmail,
        createdAccount: false,
      };
    }
  }

  const existing = await findAuthUserByEmail(admin, accountEmail);
  if ("error" in existing) return { error: "server" };

  if (existing.user) {
    if (isFrozenAuthUser(existing.user)) {
      return {
        error: "conflict",
        message: "That customer account is frozen. Unfreeze it before booking.",
      };
    }
    if (await isStaffAccount(admin, existing.user.id, accountEmail)) {
      return {
        error: "conflict",
        message: "That email belongs to a staff account.",
      };
    }
    return {
      userId: existing.user.id,
      email: accountEmail,
      createdAccount: false,
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: accountEmail,
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
    },
    app_metadata: {
      staff_created: true,
      unclaimed: true,
      phone_placeholder_email: !input.email && Boolean(input.phone),
    },
  });
  if (error || !data.user) {
    console.error("createStaffCustomerBooking createUser failed:", error?.message);
    return { error: "server" };
  }

  return {
    userId: data.user.id,
    email: accountEmail,
    createdAccount: true,
  };
}

async function sendInviteMessages(
  input: StaffCustomerBookingInput,
  bookUrl: string,
  createdAccount: boolean,
) {
  let emailed = false;
  let texted = false;
  if (input.notifyEmail && input.email && isEmailConfigured()) {
    const email = buildStaffBookingInviteEmail({
      firstName: input.firstName,
      bookUrl,
      createdAccount,
    });
    emailed = await sendEmail({
      to: input.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }
  if (input.notifySms && input.phone && isSmsConfigured()) {
    texted = await sendSms({
      to: input.phone,
      body: buildStaffBookingInviteSms(bookUrl),
    });
  }
  return { emailed, texted };
}

async function createStaffCustomerInvite(
  input: StaffCustomerBookingInput,
): Promise<
  | { booking: StaffCreatedBookingResult }
  | {
      error: "unauthenticated" | "forbidden" | "conflict" | "misconfigured" | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const bookUrl = siteUrl("/book");

  // Phone-only invites can send the public booking link without creating an account.
  if (!input.email && input.phone) {
    if (!hasSupabaseAdminConfig()) {
      const { emailed, texted } = await sendInviteMessages(input, bookUrl, false);
      return {
        booking: {
          mode: "invite",
          appointment: null,
          customer: {
            id: null,
            email: "",
            firstName: input.firstName,
            createdAccount: false,
          },
          confirmUrl: bookUrl,
          emailed,
          texted,
        },
      };
    }
  }

  if (!hasSupabaseAdminConfig()) return { error: "misconfigured" };

  try {
    const admin = createAdminClient();
    const customer = await resolveOrCreateCustomer(admin, input);
    if ("error" in customer) return customer;

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        first_name: input.firstName || null,
        last_name: input.lastName || null,
        phone: input.phone,
      })
      .eq("id", customer.userId);
    if (profileError) {
      console.error(
        "createStaffCustomerInvite profile update failed:",
        profileError.message,
      );
      return { error: "server" };
    }

    const { emailed, texted } = await sendInviteMessages(
      input,
      bookUrl,
      customer.createdAccount,
    );

    return {
      booking: {
        mode: "invite",
        appointment: null,
        customer: {
          id: customer.userId,
          email: input.email ?? customer.email,
          firstName: input.firstName,
          createdAccount: customer.createdAccount,
        },
        confirmUrl: bookUrl,
        emailed,
        texted,
      },
    };
  } catch (error) {
    console.error("createStaffCustomerInvite failed:", error);
    return { error: "server" };
  }
}

async function saveBookingPet(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  pet: StaffBookingPetInput,
): Promise<
  | { pet: { id: string } }
  | { error: "conflict" | "server"; message?: string }
> {
  if (pet.id) {
    const { data: existing, error: existingError } = await admin
      .from("pets")
      .select("id, customer_id, archived_at")
      .eq("id", pet.id)
      .maybeSingle();
    if (existingError) {
      console.error(
        "createStaffCustomerBooking pet lookup failed:",
        existingError.message,
      );
      return { error: "server" };
    }
    if (
      !existing ||
      existing.customer_id !== userId ||
      existing.archived_at != null
    ) {
      return {
        error: "conflict",
        message: "That dog is not on this customer's file.",
      };
    }

    const { data: updated, error: updateError } = await admin
      .from("pets")
      .update({
        name: pet.name,
        breed: pet.breed,
        weight_lbs: pet.weightLbs,
      })
      .eq("id", pet.id)
      .select(PET_SELECT)
      .single();
    if (updateError || !updated) {
      console.error(
        "createStaffCustomerBooking pet update failed:",
        updateError?.message,
      );
      return { error: "server" };
    }
    return { pet: updated as { id: string } };
  }

  const { data: petRow, error: petError } = await admin
    .from("pets")
    .insert({
      customer_id: userId,
      ...mapValidatedInputToInsertRow(pet),
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
  return { pet: petRow as { id: string } };
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
  if (input.mode === "invite") {
    return createStaffCustomerInvite(input);
  }

  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  if (!hasSupabaseAdminConfig()) return { error: "misconfigured" };

  const address = input.address;
  const serviceId = input.serviceId;
  const serviceName = input.serviceName;
  const appointmentDate = input.appointmentDate;
  const slotStartMinutes = input.slotStartMinutes;
  if (
    !address ||
    !serviceId ||
    !serviceName ||
    !appointmentDate ||
    slotStartMinutes == null ||
    input.pets.length === 0
  ) {
    return createStaffCustomerInvite(input);
  }

  const baseFormatted = getBaseAddressFormatted();
  const base = await getBaseGeoPoint();
  if (!baseFormatted || !base) return { error: "misconfigured" };

  const customerQuery = formatServiceAddress(address);
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

  const firstPet = input.pets[0];
  if (!firstPet) {
    return createStaffCustomerInvite(input);
  }

  const firstServiceId = firstPet.serviceId ?? serviceId;
  const firstService = allBookableServices().find(
    (entry) => entry.id === firstServiceId,
  );
  if (!firstService || !firstServiceId) {
    return { error: "conflict", message: "Unknown service." };
  }

  const firstDurationMinutes = estimateServiceDurationMinutes(
    firstServiceId,
    firstPet.weightLbs,
    input.addOnIds,
  );
  const firstAssignment = await assignArrivalWindow({
    date: appointmentDate,
    point: destination,
    zip: address.zip,
    durationMinutes: firstDurationMinutes,
    slotStartMinutes,
    base,
  });
  const firstSchedule = resolveArrivalForBooking(firstAssignment, slotStartMinutes);
  if ("error" in firstSchedule) return { error: "slot_unavailable" };

  const claimed = await claimDayPlan(appointmentDate, address.zip, destination);
  if ("error" in claimed) {
    if (claimed.error === "slot_unavailable") return { error: "slot_unavailable" };
    console.error(
      "createStaffCustomerBooking day plan was not claimed; booking continues:",
      claimed.error,
    );
  }

  try {
    const admin = createAdminClient();
    const customer = await resolveOrCreateCustomer(admin, input);
    if ("error" in customer) return customer;
    const { userId, email: accountEmail, createdAccount } = customer;

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        first_name: input.firstName || null,
        last_name: input.lastName || null,
        phone: input.phone,
      })
      .eq("id", userId);
    if (profileError) {
      console.error(
        "createStaffCustomerBooking profile update failed:",
        profileError.message,
      );
    }

    const confirm = createCustomerConfirmToken();
    const confirmExpiresAt = customerConfirmExpiryIso();
    const appointments: AppointmentRecord[] = [];
    let previousStart = firstSchedule.scheduledStart;
    let previousDuration = firstDurationMinutes;
    let visitIndex = 0;

    for (const pet of input.pets) {
      const savedPet = await saveBookingPet(admin, userId, pet);
      if ("error" in savedPet) return savedPet;
      const petRow = savedPet.pet;

      await keepPrimaryIfReferralFails(petRow, async () => {
        const { ensurePetReferralCode } = await import("@/lib/referrals/service");
        await ensurePetReferralCode({
          petId: petRow.id as string,
          petName: pet.name,
          ownerCustomerId: userId,
        });
      });

      const petServiceIds =
        pet.serviceIds.length > 0
          ? pet.serviceIds
          : pet.serviceId
            ? [pet.serviceId]
            : serviceId
              ? [serviceId]
              : [];

      for (const [visitServiceIndex, petServiceId] of petServiceIds.entries()) {
        const petService = allBookableServices().find(
          (entry) => entry.id === petServiceId,
        );
        if (!petService) {
          return { error: "conflict", message: "Unknown service." };
        }
        const durationMinutes = estimateServiceDurationMinutes(
          petServiceId,
          pet.weightLbs,
          input.addOnIds,
        );
        const companion =
          visitIndex === 0
            ? null
            : buildSameAddressCompanionInsertion(
                previousStart,
                previousDuration,
                durationMinutes,
              );
        if (visitIndex > 0 && !companion) {
          return {
            error: "slot_unavailable",
            message:
              "Not enough time left that day to schedule every service from the selected start time.",
          };
        }
        const insertion =
          visitIndex === 0
            ? firstSchedule
            : {
                appointmentTime: companion!.appointmentTime,
                scheduledStart: companion!.scheduledStart,
                timePreference: companion!.usedPreference,
              };

        const optionName = pet.serviceOptionNames[visitServiceIndex] ?? null;
        const serviceName =
          (optionName
            ? parseStaffServiceSelection(`${petService.id}::${optionName}`)
                ?.label
            : null) || petService.name;
        const price = getServicePriceEstimate(
          petService,
          pet.weightLbs,
          optionName ?? undefined,
        );
        const travelFee = visitIndex === 0 ? quote.fee : 0;
        const estimatedTotal =
          Math.round(((price?.from ?? 0) + travelFee) * 100) / 100;

        const { data: appointmentRow, error: appointmentError } = await admin
          .from("appointments")
          .insert({
            customer_id: userId,
            pet_id: petRow.id,
            service_id: petService.id,
            service_name: serviceName,
            add_on_ids: input.addOnIds,
            add_on_options: optionName ? { [petService.id]: optionName } : {},
            address_street: address.street,
            address_city: address.city,
            address_state: address.state,
            address_zip: address.zip,
            travel_distance_miles: quote.distanceMiles,
            travel_fee: travelFee,
            appointment_date: appointmentDate,
            appointment_time: insertion.appointmentTime,
            scheduled_start: insertion.scheduledStart,
            time_preference: insertion.timePreference,
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
            customer_confirm_expires_at: confirmExpiresAt,
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
        appointments.push(appointment);
        previousStart = insertion.scheduledStart;
        previousDuration = durationMinutes;
        visitIndex += 1;
      }
    }

    const appointment = appointments[0]!;
    const confirmUrl = siteUrl(customerConfirmPath(confirm.token));
    const petNames = appointments.map((entry) => entry.petName);

    let emailed = false;
    let texted = false;
    if (input.notifyEmail && input.email && isEmailConfigured()) {
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
    if (input.notifySms && input.phone && isSmsConfigured()) {
      texted = await sendSms({
        to: input.phone,
        body: buildStaffCreatedBookingSms(appointment, confirmUrl, petNames),
      });
    }

    return {
      booking: {
        mode: "booking",
        appointment,
        customer: {
          id: userId,
          email: input.email ?? accountEmail,
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

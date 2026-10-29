import { business } from "@/lib/business";
import type {
  AppointmentWriteInput,
  AppointmentRow,
} from "@/lib/appointments/types";
import { mapAppointmentRowToRecord } from "@/lib/appointments/map";
import {
  createAuthenticatedSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/pets/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PET_SELECT, type PetRow } from "@/lib/pets/types";
import { mapPetRowToRecord } from "@/lib/pets/map";
import { bookingWeightLbs } from "@/lib/pets/weight";
import { getCustomerPaymentMethod } from "@/lib/payments/service";
import { resolveGuestDrivingQuote } from "@/lib/booking-distance";
import { quoteGuestBooking, type BookingPriceQuote } from "@/lib/booking-price";
import { estimateServiceDurationMinutes } from "@/lib/services";
import {
  assignArrivalWindow,
  claimDayPlan,
  getBaseGeoPoint,
} from "@/lib/appointments/schedule";
import { getDayBounds, preferenceFromStart } from "@/lib/booking-schedule";
import { resolveArrivalForBooking } from "@/lib/appointments/arrival-window";
import { formatMinutesLabel } from "@/lib/appointments/closures";
import { groupBookingIntentHash } from "@/lib/booking/group";
import { loadBookingAllergySnapshot } from "@/lib/appointments/service";
import { allergySnapshotForBooking } from "@/lib/allergies";
import { vaccinationStatusSnapshotForBooking } from "@/lib/vaccinations/booking";
import { attachVaccinationSummaries } from "@/lib/vaccinations/service";
import {
  guestBookingStoredAddOnOptions,
  guestBookingStoredServicePrice,
} from "@/lib/appointments/stored-service-price";
import { fetchCustomerContact } from "@/lib/email/appointment-context";
import { notifyCustomerAppointmentSubmitted } from "@/lib/email/appointment-mails";
import { notifyMerchantVisitCreatedFromVisit } from "@/lib/communications/merchant-notices";

type ErrorCode =
  | "unauthenticated"
  | "not_found"
  | "server"
  | "payment_required"
  | "weight_required"
  | "invalid_selection"
  | "address_unverified"
  | "price_changed"
  | "slot_unavailable"
  | "idempotency_mismatch";
type Failure = {
  error: ErrorCode;
  message?: string;
  quotes?: BookingPriceQuote[];
};
const fail = (error: ErrorCode, message?: string): Failure => ({
  error,
  message,
});

/** One stop, all dogs saved atomically, one travel fee and one confirmation. */
export async function createGroupAppointment(inputs: AppointmentWriteInput[]) {
  const user = await requireAuthenticatedUser();
  if (!user) return fail("unauthenticated");
  const first = inputs[0];
  if (!first || inputs.length < 2) return fail("invalid_selection");
  const supabase = await createAuthenticatedSupabaseClient();
  const admin = createAdminClient();
  const payloadHash = groupBookingIntentHash(inputs);

  async function reload(appointmentId: string) {
    const { data, error } = await supabase
      .from("appointments")
      .select("*, pets ( name, breed )")
      .eq("id", appointmentId)
      .eq("customer_id", user!.id)
      .single();
    return error || !data
      ? fail("server")
      : { appointment: mapAppointmentRowToRecord(data as AppointmentRow) };
  }

  // A retry must return its committed visit before scheduling sees that visit as occupied.
  const previous = await admin
    .from("guest_booking_requests")
    .select("appointment_id, payload_hash")
    .eq("customer_id", user.id)
    .eq("idempotency_key", first.idempotencyKey)
    .maybeSingle();
  if (previous.error) return fail("server");
  if (previous.data) {
    if (previous.data.payload_hash !== payloadHash)
      return fail("idempotency_mismatch");
    if (previous.data.appointment_id)
      return reload(previous.data.appointment_id);
  }

  const { data: rows, error: petError } = await supabase
    .from("pets")
    .select(PET_SELECT)
    .eq("customer_id", user.id)
    .is("archived_at", null)
    .in(
      "id",
      inputs.map((input) => input.petId),
    );
  if (petError) return fail("server");
  if (rows?.length !== inputs.length) return fail("not_found");
  let mappedPets = (rows as PetRow[]).map(mapPetRowToRecord);
  try {
    mappedPets = await attachVaccinationSummaries(mappedPets);
  } catch (error) {
    console.error(
      "group booking optional vaccination summary unavailable:",
      error,
    );
  }
  const pets = new Map(mappedPets.map((pet) => [pet.id, pet]));
  if (!(await getCustomerPaymentMethod(user.id, first.paymentMethodId)))
    return fail("payment_required");
  const measured = await resolveGuestDrivingQuote(first.address);
  if (!measured.ok)
    return fail(
      measured.code === "outside_area"
        ? "invalid_selection"
        : "address_unverified",
      measured.message,
    );
  const quotes: BookingPriceQuote[] = [];
  const durations: number[] = [];
  for (const [index, input] of inputs.entries()) {
    const pet = pets.get(input.petId)!;
    const weight = bookingWeightLbs(pet.weightLbs);
    if (weight == null) return fail("weight_required");
    const priced = quoteGuestBooking({
      serviceId: input.serviceId,
      fixedServicePrices: pet.fixedServicePrices,
      weightLbs: weight,
      addOnIds: input.addOnIds,
      addOnOptions: input.addOnOptions,
      distanceMiles: index === 0 ? measured.distanceMiles : 0,
    });
    if (!priced.ok)
      return fail("invalid_selection", `${pet.name}: ${priced.message}`);
    quotes.push(priced.quote);
    durations.push(
      estimateServiceDurationMinutes(input.serviceId, weight, input.addOnIds),
    );
  }
  if (
    quotes.some(
      (quote, index) =>
        Math.abs(quote.estimatedTotal - inputs[index].estimatedTotal) > 0.009,
    )
  ) {
    return {
      error: "price_changed",
      message:
        "The estimated total changed. Review the latest prices, then confirm again.",
      quotes,
    } satisfies Failure;
  }
  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
  const { hoursStart, hoursEnd } = getDayBounds();
  if (
    first.slotStartMinutes < hoursStart ||
    first.slotStartMinutes + totalDuration > hoursEnd
  )
    return fail("slot_unavailable");
  const base = await getBaseGeoPoint();
  const assignment = base
    ? await assignArrivalWindow({
        date: first.appointmentDate,
        point: measured.point,
        zip: first.address.zip,
        durationMinutes: totalDuration,
        slotStartMinutes: first.slotStartMinutes,
        base,
      })
    : { error: "misconfigured" };
  const schedule = resolveArrivalForBooking(assignment, first.slotStartMinutes);
  if ("error" in schedule) return fail("slot_unavailable");
  if (base) {
    const claimed = await claimDayPlan(
      first.appointmentDate,
      first.address.zip,
      measured.point,
    );
    if ("error" in claimed && claimed.error === "slot_unavailable")
      return fail("slot_unavailable");
  }
  const address = {
    address_street: first.address.street,
    address_city: first.address.city,
    address_state: first.address.state,
    address_zip: first.address.zip,
    address_lat: measured.point.lat,
    address_lon: measured.point.lon,
    timezone: business.booking.timezone,
  };
  let start = schedule.scheduledStart;
  const appointments: Record<string, unknown>[] = [];
  for (const [index, input] of inputs.entries()) {
    const quote = quotes[index];
    const allergy = await loadBookingAllergySnapshot(
      user.id,
      input.petId,
      pets.get(input.petId)!.name,
    );
    appointments.push({
      ...address,
      customer_id: user.id,
      pet_id: input.petId,
      service_id: quote.serviceId,
      service_name: quote.serviceName,
      add_on_ids: input.addOnIds,
      add_on_options: guestBookingStoredAddOnOptions(quote, input.addOnOptions),
      spa_goals: input.spaGoals ?? [],
      allergy_snapshot: allergySnapshotForBooking(allergy),
      appointment_date: first.appointmentDate,
      scheduled_start: start,
      appointment_time:
        index === 0 ? schedule.appointmentTime : formatMinutesLabel(start),
      time_preference: preferenceFromStart(start),
      visit_sequence: index + 1,
      estimated_duration_minutes: durations[index],
      travel_distance_miles: measured.distanceMiles,
      travel_fee: quote.travelFee,
      estimated_total: quote.estimatedTotal,
      service_price: guestBookingStoredServicePrice(quote),
      new_client_deposit: 0,
      payment_method_id: first.paymentMethodId,
      vaccination_status_at_booking: vaccinationStatusSnapshotForBooking(
        pets.get(input.petId)!,
      ),
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      staff_created: false,
    });
    start += durations[index];
  }
  const { data, error } = await admin.rpc("create_guest_group_booking", {
    p_idempotency_key: first.idempotencyKey,
    p_payload_hash: payloadHash,
    p_visit: {
      ...address,
      customer_id: user.id,
      service_date: first.appointmentDate,
      scheduled_start: schedule.scheduledStart,
      time_preference: schedule.timePreference,
      status: "confirmed",
      travel_distance_miles: measured.distanceMiles,
      travel_fee: quotes[0].travelFee,
      travel_fee_automatic: quotes[0].travelFee,
      travel_fee_override: null,
    },
    p_appointments: appointments,
  });
  if (error) {
    console.error(
      "create_guest_group_booking failed:",
      error.code,
      error.message,
    );
    if (error.message?.includes("idempotency_mismatch"))
      return fail("idempotency_mismatch");
    if (error.message?.includes("pet_not_found")) return fail("not_found");
    if (error.message?.includes("payment_required"))
      return fail("payment_required");
    if (error.message?.includes("slot_unavailable") || error.code === "23505")
      return fail("slot_unavailable");
    return fail("server");
  }
  const saved = data as { appointment_id?: string; created?: boolean } | null;
  if (!saved?.appointment_id) return fail("server");
  const result = await reload(saved.appointment_id);
  if ("error" in result || !saved.created) return result;

  // Commit is complete. Optional profile, referral, and delivery failures must not undo it.
  try {
    await supabase
      .from("profiles")
      .update({
        first_name: first.customerFirstName,
        last_name: first.customerLastName,
        phone: first.customerPhone,
      })
      .eq("id", user.id);
  } catch {
    /* non-blocking */
  }
  if (first.referralCode?.trim()) {
    try {
      const { attachReferralOnBooking, validateReferralCodeForCustomer } =
        await import("@/lib/referrals/service");
      if (
        (await validateReferralCodeForCustomer(user.id, first.referralCode))
          .valid
      ) {
        await attachReferralOnBooking({
          referredCustomerId: user.id,
          appointmentId: result.appointment.id,
          code: first.referralCode,
        });
      }
    } catch (err) {
      console.error("group booking referral skipped:", err);
    }
  }
  let contact: Awaited<ReturnType<typeof fetchCustomerContact>> = null;
  try {
    contact = await fetchCustomerContact(user.id);
    if (contact)
      await notifyCustomerAppointmentSubmitted(result.appointment, contact, {
        petNames: inputs.map((input) => pets.get(input.petId)!.name),
        serviceNames: inputs.map(
          (input) => `${pets.get(input.petId)!.name} · ${input.serviceName}`,
        ),
      });
  } catch (err) {
    console.error("group booking confirmation failed:", err);
  }
  try {
    await notifyMerchantVisitCreatedFromVisit(result.appointment.visitId, {
      customerName: contact?.name ?? null,
      replyTo: contact?.email ?? null,
    });
  } catch (err) {
    console.error("group booking merchant notice failed:", err);
  }
  return result;
}

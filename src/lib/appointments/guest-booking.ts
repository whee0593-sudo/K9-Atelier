import { createHash } from "node:crypto";
import type { ServiceAddress } from "@/lib/travel";

type GuestBookingClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

export type GuestBookingIntent = {
  petId: string;
  serviceId: string;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  spaGoals?: string[];
  address: ServiceAddress;
  appointmentDate: string;
  slotStartMinutes: number;
  paymentMethodId: string;
};

/** Identity of one booking attempt. Price and mileage are excluded because the server recalculates both. */
export function guestBookingIntentHash(input: GuestBookingIntent) {
  const addOnOptions = Object.fromEntries(
    Object.entries(input.addOnOptions).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  const canonical = JSON.stringify({
    petId: input.petId,
    serviceId: input.serviceId,
    addOnIds: [...input.addOnIds].sort(),
    addOnOptions,
    spaGoals: [...(input.spaGoals ?? [])].sort(),
    street: input.address.street.trim().toLowerCase(),
    city: input.address.city.trim().toLowerCase(),
    state: input.address.state.trim().toUpperCase(),
    zip: input.address.zip.trim(),
    appointmentDate: input.appointmentDate,
    slotStartMinutes: input.slotStartMinutes,
    paymentMethodId: input.paymentMethodId,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export type GuestBookingInsertResult =
  | { created: boolean; appointmentId: string }
  | {
      error:
        | "idempotency_mismatch"
        | "slot_unavailable"
        | "payment_required"
        | "not_found"
        | "server";
    };

function guestBookingError(error: { code?: string; message?: string }): GuestBookingInsertResult {
  const message = error.message ?? "";
  if (message.includes("idempotency_mismatch")) {
    return { error: "idempotency_mismatch" };
  }
  if (message.includes("payment_required")) return { error: "payment_required" };
  if (message.includes("pet_not_found")) return { error: "not_found" };
  if (error.code === "23505" || message.includes("duplicate key")) {
    return { error: "slot_unavailable" };
  }
  return { error: "server" };
}

/**
 * Insert the visit and appointment in one database function.
 * Only the service role may execute that function. The visit, the appointment,
 * and the idempotency claim commit or roll back together. A repeated key with
 * the same contents returns the original appointment and does not insert again.
 */
export async function insertGuestBooking(
  supabase: GuestBookingClient,
  input: {
    idempotencyKey: string;
    payloadHash: string;
    visit: Record<string, unknown>;
    appointment: Record<string, unknown>;
  },
): Promise<GuestBookingInsertResult> {
  const { data, error } = await supabase.rpc("create_guest_booking", {
    p_idempotency_key: input.idempotencyKey,
    p_payload_hash: input.payloadHash,
    p_visit: input.visit,
    p_appointment: input.appointment,
  });
  if (error) {
    console.error("create_guest_booking failed:", error.code, error.message);
    return guestBookingError(error);
  }
  const body = data as { created?: boolean; appointment_id?: string } | null;
  if (!body?.appointment_id) return { error: "server" };
  return { created: body.created === true, appointmentId: body.appointment_id };
}

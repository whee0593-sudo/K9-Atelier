import { estimateServiceDurationMinutes } from "@/lib/services";

/** Same upper bound as pet profile validation and pets_weight_lbs_check. */
export const MAX_PET_WEIGHT_LBS = 200;

export const WEIGHT_REQUIRED_MESSAGE =
  "Add this dog's weight before booking. Weight must be greater than 0 and at most 200 lbs.";

/**
 * Read a stored weight without turning null into 0.
 * Zero, negative, and over-max values stay numeric so booking can reject them.
 */
export function readStoredWeightLbs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

/** A weight that may select a grooming tier. Missing and out of range are both unusable. */
export function bookingWeightLbs(value: unknown): number | null {
  const parsed = readStoredWeightLbs(value);
  if (parsed == null || parsed <= 0 || parsed > MAX_PET_WEIGHT_LBS) return null;
  return parsed;
}

/**
 * Duration for a new or rewritten appointment.
 * Returns null when the weight cannot select a tier, so callers keep a stored duration
 * instead of inventing one.
 */
export function liveServiceDurationMinutes(
  serviceId: string,
  weightLbs: unknown,
  addOnIds: readonly string[] | null | undefined,
): number | null {
  const weight = bookingWeightLbs(weightLbs);
  if (weight == null) return null;
  return estimateServiceDurationMinutes(
    serviceId,
    weight,
    (addOnIds ?? []).filter((id): id is string => typeof id === "string"),
  );
}

import { bookingDurationMinutes } from "@/lib/booking-flow";
import { bookingWeightLbs } from "@/lib/pets/weight";

/**
 * Duration passed to scheduling after a usable weight is present.
 * An override is accepted only for that same valid weight.
 */
export function resolveAvailabilityDuration(input: {
  serviceId: string;
  weightLbs: unknown;
  addOnIds: readonly string[];
  durationOverride?: number;
}): { durationMinutes: number } | { error: "weight_required" } {
  const weightLbs = bookingWeightLbs(input.weightLbs);
  if (weightLbs == null) return { error: "weight_required" };
  const override = input.durationOverride;
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return { durationMinutes: override };
  }
  return {
    durationMinutes: bookingDurationMinutes(input.serviceId, weightLbs, [
      ...input.addOnIds,
    ]),
  };
}

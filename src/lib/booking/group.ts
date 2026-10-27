import type { AppointmentWriteInput } from "@/lib/appointments/types";
import {
  AppointmentValidationError,
  validateCreateAppointmentInput,
} from "@/lib/appointments/validation";
import { guestBookingIntentHash } from "@/lib/appointments/guest-booking";
import { createHash } from "node:crypto";

/** Shared appointment fields are read once; individual dogs cannot override them. */
export function validateGroupBookingInput(
  body: unknown,
): AppointmentWriteInput[] {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new AppointmentValidationError("Invalid request body.");
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.dogs) || record.dogs.length < 2)
    throw new AppointmentValidationError(
      "Add at least two dogs to this visit.",
      "dogs",
    );
  const inputs = record.dogs.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new AppointmentValidationError("Invalid dog details.", "dogs");
    const dog = value as Record<string, unknown>;
    return validateCreateAppointmentInput({
      ...record,
      petId: dog.petId,
      serviceId: dog.serviceId,
      serviceName: dog.serviceName,
      addOnIds: dog.addOnIds,
      addOnOptions: dog.addOnOptions,
      spaGoals: dog.spaGoals,
      estimatedTotal: dog.estimatedTotal,
    });
  });
  if (new Set(inputs.map((input) => input.petId)).size !== inputs.length)
    throw new AppointmentValidationError(
      "Each dog can only be added once to this visit.",
      "dogs",
    );
  return inputs;
}

export function groupBookingIntentHash(inputs: AppointmentWriteInput[]) {
  return createHash("sha256")
    .update(JSON.stringify(inputs.map(guestBookingIntentHash)))
    .digest("hex");
}

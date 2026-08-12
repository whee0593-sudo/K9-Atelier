import type { PetRecord } from "@/lib/pets/types";

export function isServiceError<T extends string>(
  result: Record<string, unknown>,
): result is { error: T } {
  return "error" in result;
}

export function getServicePet(result: { pet: PetRecord } | { error: string }) {
  if (isServiceError(result)) return null;
  return result.pet;
}

export function getServicePets(
  result: { pets: PetRecord[] } | { error: string },
) {
  if (isServiceError(result)) return null;
  return result.pets;
}

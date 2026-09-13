import type { PetProfile } from "@/lib/pets";

export const ACCOUNT_SETUP_PATH = "/account/setup";
export const ACCOUNT_SETUP_PET_STORAGE_KEY = "k9-account-setup-pet";

export function petsSetupHref(petId?: string | null) {
  const params = new URLSearchParams({ setup: "1" });
  if (petId) params.set("pet", petId);
  return `/account/pets?${params.toString()}`;
}

export function paymentSetupHref() {
  return "/account/payment?setup=1";
}

export function rememberSetupPetId(petId: string | null | undefined) {
  if (typeof window === "undefined") return;
  if (!petId) return;
  window.sessionStorage.setItem(ACCOUNT_SETUP_PET_STORAGE_KEY, petId);
}

export function readRememberedSetupPetId() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ACCOUNT_SETUP_PET_STORAGE_KEY);
}

export function petNeedsVaccinationRecord(pet: PetProfile) {
  if (pet.vaccineRecordUploaded) return false;
  const status = pet.vaccinationBookingStatus ?? "missing";
  return status === "missing" || status === "needs_attention";
}

export function petToExpandForSetup(
  pets: PetProfile[],
  requestedPetId?: string | null,
) {
  if (requestedPetId && pets.some((pet) => pet.id === requestedPetId)) {
    return requestedPetId;
  }
  return pets.find(petNeedsVaccinationRecord)?.id ?? pets[0]?.id ?? null;
}

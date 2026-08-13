import type { PetRecord } from "@/lib/pets/types";
import type { PetProfile } from "@/lib/pets";
import type { VaccinationBookingStatus } from "@/lib/vaccinations/types";

export function vaccinationReadyToBook(
  status: VaccinationBookingStatus | undefined,
) {
  return (
    status === "current" ||
    status === "expiring_soon" ||
    status === "needs_review"
  );
}

export function vaccinationBookingNeedsAdminConfirmation(
  status: VaccinationBookingStatus | undefined,
) {
  return status === "needs_review";
}

export function vaccinationBookingConfirmedImmediately(
  status: VaccinationBookingStatus | undefined,
) {
  return status === "current" || status === "expiring_soon";
}

export function vaccinationHasUpload(
  record: Pick<PetRecord, "vaccinationHasUpload" | "vaccinationBookingStatus">,
) {
  if (record.vaccinationHasUpload != null) {
    return record.vaccinationHasUpload;
  }
  return (record.vaccinationBookingStatus ?? "missing") !== "missing";
}

export function vaccinationStatusLabel(status: VaccinationBookingStatus) {
  switch (status) {
    case "current":
    case "expiring_soon":
      return "Vaccines on file";
    case "needs_review":
      return "Pending review";
    case "needs_attention":
      return "Needs attention";
    case "expired":
      return "Vaccines expired";
    default:
      return "Vaccines required";
  }
}

export function petProfileReadyToBook(pet: PetProfile) {
  return vaccinationReadyToBook(pet.vaccinationBookingStatus);
}

export function petProfileVaccinationLabel(pet: PetProfile) {
  return vaccinationStatusLabel(pet.vaccinationBookingStatus ?? "missing");
}

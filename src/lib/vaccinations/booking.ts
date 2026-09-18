import type { PetRecord } from "@/lib/pets/types";
import {
  parsePetRabiesStatus,
  type PetRabiesStatus,
} from "@/lib/pets/types";
import type { PetProfile } from "@/lib/pets";
import type { VaccinationBookingStatus } from "@/lib/vaccinations/types";

export { parsePetRabiesStatus };
export type { PetRabiesStatus };

export const RABIES_STATUS_OPTIONS: Array<{
  value: PetRabiesStatus;
  label: string;
}> = [
  { value: "current", label: "Current rabies vaccination" },
  {
    value: "medical_exemption",
    label: "Veterinarian-issued medical exemption",
  },
];

export function rabiesStatusDisplayLabel(status: PetRabiesStatus) {
  return status === "medical_exemption"
    ? "Veterinary Medical Exemption"
    : "Current";
}

export function petHasConfirmedRabiesStatus(pet: {
  rabiesStatus?: PetRabiesStatus | null;
  vaccineRecordUploaded?: boolean;
  vaccinationHasUpload?: boolean;
  vaccinationBookingStatus?: VaccinationBookingStatus;
}) {
  if (parsePetRabiesStatus(pet.rabiesStatus)) return true;
  if (pet.vaccineRecordUploaded || pet.vaccinationHasUpload) return true;
  return vaccinationReadyToBook(pet.vaccinationBookingStatus);
}

/** File-based vaccine status still used as a legacy compatibility fallback. */
export function vaccinationReadyToBook(
  status: VaccinationBookingStatus | undefined,
) {
  return (
    status === "current" ||
    status === "expiring_soon" ||
    status === "needs_review"
  );
}

/** Rabies documents no longer require staff confirmation before booking. */
export function vaccinationBookingNeedsAdminConfirmation(
  _status?: VaccinationBookingStatus,
) {
  return false;
}

export function vaccinationBookingConfirmedImmediately(
  status: VaccinationBookingStatus | undefined,
) {
  return !vaccinationBookingNeedsAdminConfirmation(status);
}

export function vaccinationHasUpload(
  record: Pick<
    PetRecord,
    "vaccinationHasUpload" | "vaccinationBookingStatus"
  > & {
    vaccineRecordUploaded?: boolean;
  },
) {
  if (record.vaccinationHasUpload != null) {
    return record.vaccinationHasUpload;
  }
  if (record.vaccineRecordUploaded != null) {
    return record.vaccineRecordUploaded;
  }
  return (record.vaccinationBookingStatus ?? "missing") !== "missing";
}

export function vaccinationStatusSnapshotForBooking(pet: {
  rabiesStatus?: PetRabiesStatus | null;
  vaccinationBookingStatus?: VaccinationBookingStatus;
  vaccinationHasUpload?: boolean;
  vaccineRecordUploaded?: boolean;
}): VaccinationBookingStatus {
  if (!petHasConfirmedRabiesStatus(pet)) {
    return pet.vaccinationBookingStatus ?? "missing";
  }
  const fileStatus = pet.vaccinationBookingStatus;
  if (fileStatus && fileStatus !== "missing") return fileStatus;
  return "current";
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
  return petHasConfirmedRabiesStatus(pet);
}

export function petProfileVaccinationLabel(pet: PetProfile) {
  const status = parsePetRabiesStatus(pet.rabiesStatus);
  if (status) return rabiesStatusDisplayLabel(status);
  if (petHasConfirmedRabiesStatus(pet)) return "Current";
  return "Confirm rabies status";
}

export function petProfileRabiesRecordLabel(pet: Pick<PetProfile, "vaccineRecordUploaded">) {
  return pet.vaccineRecordUploaded ? "View Document" : "Not uploaded";
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PetVaccinationSummary,
  VaccinationBookingStatus,
} from "@/lib/vaccinations/types";

const BOOKING_STATUSES: VaccinationBookingStatus[] = [
  "current",
  "expiring_soon",
  "needs_review",
  "needs_attention",
  "expired",
  "missing",
];

function parseBookingStatus(value: unknown): VaccinationBookingStatus {
  if (
    typeof value === "string" &&
    BOOKING_STATUSES.includes(value as VaccinationBookingStatus)
  ) {
    return value as VaccinationBookingStatus;
  }
  return "missing";
}

type VaccinationRecordRow = {
  expiration_date: string | null;
  verification_status: string;
  created_at: string;
};

export async function fetchPetVaccinationSummary(
  supabase: SupabaseClient,
  petId: string,
): Promise<PetVaccinationSummary> {
  const [{ data: bookingStatus, error: statusError }, { data: records, error: recordsError }] =
    await Promise.all([
      supabase.rpc("get_pet_booking_vaccination_status", { p_pet_id: petId }),
      supabase
        .from("pet_vaccination_records")
        .select("expiration_date, verification_status, created_at")
        .eq("pet_id", petId)
        .order("created_at", { ascending: false }),
    ]);

  if (statusError) {
    console.error(
      "fetchPetVaccinationSummary status failed:",
      statusError.code,
      statusError.message,
    );
  }
  if (recordsError) {
    console.error(
      "fetchPetVaccinationSummary records failed:",
      recordsError.code,
      recordsError.message,
    );
  }

  const rows = (records ?? []) as VaccinationRecordRow[];
  const parsedStatus = parseBookingStatus(bookingStatus);
  const expirationDate = pickDisplayedExpiration(rows);

  return {
    bookingStatus: parsedStatus,
    expirationDate,
    hasUpload: rows.length > 0,
  };
}

function pickDisplayedExpiration(rows: VaccinationRecordRow[]) {
  const verifiedCurrent = rows.find(
    (row) =>
      row.verification_status === "verified" &&
      (row.expiration_date == null ||
        row.expiration_date >= new Date().toISOString().slice(0, 10)),
  );
  if (verifiedCurrent?.expiration_date) {
    return verifiedCurrent.expiration_date;
  }

  return rows.find((row) => row.expiration_date)?.expiration_date ?? null;
}

export async function enrichPetRecordsWithVaccination<T extends { id: string }>(
  supabase: SupabaseClient,
  pets: T[],
): Promise<
  Array<
    T & {
      vaccinationBookingStatus: VaccinationBookingStatus;
      vaccinationExpirationDate: string | null;
      vaccinationHasUpload: boolean;
    }
  >
> {
  return Promise.all(
    pets.map(async (pet) => {
      const summary = await fetchPetVaccinationSummary(supabase, pet.id);
      return {
        ...pet,
        vaccinationBookingStatus: summary.bookingStatus,
        vaccinationExpirationDate: summary.expirationDate,
        vaccinationHasUpload: summary.hasUpload,
      };
    }),
  );
}

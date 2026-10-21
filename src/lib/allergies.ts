export const ALLERGY_STATUSES = ["yes", "none", "unsure"] as const;

export type AllergyStatus = (typeof ALLERGY_STATUSES)[number];

export const ALLERGY_HEADING = "Known Allergies & Sensitivities";
export const ALLERGY_QUESTION =
  "Does your pup or anyone in your household have any known allergies or sensitivities we should be aware of?";
export const ALLERGY_DETAILS_LABEL =
  "Please describe the allergies and who is affected.";

export const ALLERGY_CHOICES = [
  { value: "yes", label: "Yes" },
  { value: "none", label: "No known allergies" },
  { value: "unsure", label: "Not sure" },
] as const;

export type AllergySnapshot = {
  petName: string;
  petStatus: AllergyStatus | null;
  petDetails: string | null;
  householdStatus: AllergyStatus | null;
  householdDetails: string | null;
};

export type AllergyWarning = {
  banner: string;
  lines: string[];
};

const STATUS_SET = new Set<string>(ALLERGY_STATUSES);

export function isAllergyStatus(value: string): value is AllergyStatus {
  return STATUS_SET.has(value);
}

/**
 * Omitted stays omitted (`undefined`) so an update does not invent "none".
 * Blank becomes null. "none" is stored only when the customer chose it.
 */
export function readAllergyStatus(
  value: unknown,
): AllergyStatus | null | undefined {
  if (value === undefined) return undefined;
  if (value == null || value === "") return null;
  if (typeof value === "string" && isAllergyStatus(value)) return value;
  return undefined;
}

export function allergyStatusLabel(status: AllergyStatus | null | undefined) {
  if (status === "yes") return "Yes";
  if (status === "none") return "No known allergies";
  if (status === "unsure") return "Not sure";
  return "Not recorded";
}

export const ALLERGY_PROFILE_UNAVAILABLE_MESSAGE =
  "We could not load allergy and sensitivity information. Please try again. This appointment was not saved.";

export type AllergySnapshotLoad =
  | { ok: true; snapshot: AllergySnapshot }
  | { ok: false; error: "unavailable" };

/** Failed reads remain unknown; they do not prevent booking or imply no allergies. */
export function allergySnapshotForBooking(load: AllergySnapshotLoad): AllergySnapshot | null {
  return load.ok ? load.snapshot : null;
}

type AllergyPetRead = {
  name?: string | null;
  allergy_status?: unknown;
  allergy_details?: unknown;
} | null;

type AllergyProfileRead = {
  household_allergy_status?: unknown;
  household_allergy_details?: unknown;
} | null;

/**
 * A database error, a missing pet row, or an unrecognized status is a failed
 * read. It is not "No known allergies", Not sure, or an unfilled profile.
 * A successful read with a null status stays unfilled.
 */
export function allergySnapshotFromProfileRead(input: {
  petError: boolean;
  profileError: boolean;
  pet: AllergyPetRead;
  profile: AllergyProfileRead;
  fallbackPetName: string;
}): AllergySnapshotLoad {
  if (input.petError || input.profileError || input.pet == null) {
    return { ok: false, error: "unavailable" };
  }
  const petStatus = readAllergyStatus(input.pet.allergy_status ?? null);
  const householdStatus = readAllergyStatus(
    input.profile?.household_allergy_status ?? null,
  );
  if (petStatus === undefined || householdStatus === undefined) {
    return { ok: false, error: "unavailable" };
  }
  return {
    ok: true,
    snapshot: buildAllergySnapshot({
      petName:
        typeof input.pet.name === "string" && input.pet.name.trim()
          ? input.pet.name
          : input.fallbackPetName,
      petStatus,
      petDetails:
        typeof input.pet.allergy_details === "string"
          ? input.pet.allergy_details
          : null,
      householdStatus,
      householdDetails:
        typeof input.profile?.household_allergy_details === "string"
          ? input.profile.household_allergy_details
          : null,
    }),
  };
}

function cleanDetails(status: AllergyStatus | null, details: string | null) {
  if (status !== "yes") return null;
  const trimmed = details?.trim() ?? "";
  return trimmed || null;
}

export function buildAllergySnapshot(input: {
  petName: string;
  petStatus: AllergyStatus | null;
  petDetails?: string | null;
  householdStatus: AllergyStatus | null;
  householdDetails?: string | null;
}): AllergySnapshot {
  return {
    petName: input.petName.trim() || "Dog",
    petStatus: input.petStatus,
    petDetails: cleanDetails(input.petStatus, input.petDetails ?? null),
    householdStatus: input.householdStatus,
    householdDetails: cleanDetails(
      input.householdStatus,
      input.householdDetails ?? null,
    ),
  };
}

export function parseAllergySnapshot(value: unknown): AllergySnapshot | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const petStatus = readAllergyStatus(
    record.petStatus === undefined ? null : record.petStatus,
  );
  const householdStatus = readAllergyStatus(
    record.householdStatus === undefined ? null : record.householdStatus,
  );
  if (petStatus === undefined || householdStatus === undefined) return null;
  const petDetails =
    typeof record.petDetails === "string" ? record.petDetails : null;
  const householdDetails =
    typeof record.householdDetails === "string"
      ? record.householdDetails
      : null;
  return buildAllergySnapshot({
    petName: typeof record.petName === "string" ? record.petName : "Dog",
    petStatus,
    petDetails,
    householdStatus,
    householdDetails,
  });
}

type KnownAllergy = { who: string; details: string };

function knownAllergies(snapshot: AllergySnapshot): KnownAllergy[] {
  const entries: KnownAllergy[] = [];
  if (snapshot.petStatus === "yes") {
    entries.push({
      who: snapshot.petName,
      details: snapshot.petDetails?.trim() || "No description provided",
    });
  }
  if (snapshot.householdStatus === "yes") {
    entries.push({
      who: "Household",
      details: snapshot.householdDetails?.trim() || "No description provided",
    });
  }
  return entries;
}

/**
 * A warning exists only for an explicit Yes. Not sure, blank, and
 * "No known allergies" do not become a confirmed-clear or a false alert.
 * The text is the customer's own words. Nothing is inferred or shortened.
 */
export function allergyWarning(snapshot: AllergySnapshot | null): AllergyWarning | null {
  if (!snapshot) return null;
  const entries = knownAllergies(snapshot);
  if (!entries.length) return null;
  const lines = entries.map((entry) =>
    `${entry.who}: ${entry.details}`.toUpperCase(),
  );
  return {
    banner: `ALLERGY: ${lines.join(" · ")}`,
    lines,
  };
}

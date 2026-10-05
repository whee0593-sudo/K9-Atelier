import {
  buildReferralCodeBase,
  nextReferralCodeCandidate,
  normalizeReferralCode,
} from "@/lib/referrals/codes";

/** Postgres default name for UNIQUE (referral_code_normalized). */
export const REFERRAL_CODE_NORMALIZED_CONSTRAINT =
  "pet_referral_codes_referral_code_normalized_key";

/** Postgres default name for UNIQUE (pet_id). */
export const REFERRAL_CODE_PET_CONSTRAINT = "pet_referral_codes_pet_id_key";

export const REFERRAL_CODE_MAX_ATTEMPTS = 40;

export const REFERRAL_CLIENT_ERROR =
  "We couldn’t load referral rewards. Please try again.";

export type ReferralWriteError = {
  code?: string | number | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type ReferralCodeInsert = {
  pet_id: string;
  owner_customer_id: string;
  referral_code: string;
  referral_code_normalized: string;
  is_active: boolean;
};

export type ReferralCodeStore = {
  findByPetId(
    petId: string,
  ): Promise<{ referral_code: string } | null>;
  findOwnerName(
    ownerCustomerId: string,
  ): Promise<{ first_name?: string | null; last_name?: string | null } | null>;
  insert(
    row: ReferralCodeInsert,
  ): Promise<{ ok: true } | { ok: false; error: ReferralWriteError }>;
};

export type ReferralAllocation =
  | { ok: true; code: string }
  | {
      ok: false;
      reason: "exhausted" | "pet_row_exists" | "database";
      error: ReferralWriteError | null;
    };

export function toReferralWriteError(error: unknown): ReferralWriteError {
  if (error && typeof error === "object") {
    const row = error as Record<string, unknown> & { message?: unknown };
    const code = row.code ?? row.error_code ?? row.sqlstate;
    return {
      code:
        typeof code === "string" || typeof code === "number" ? code : null,
      message: typeof row.message === "string" ? row.message : null,
      details: typeof row.details === "string" ? row.details : null,
      hint: typeof row.hint === "string" ? row.hint : null,
    };
  }
  return { message: typeof error === "string" ? error : null };
}

export function describeReferralWriteError(error: ReferralWriteError | null) {
  return {
    code: error?.code == null ? null : String(error.code).trim(),
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    constraint: error ? referralConstraintName(error) : null,
  };
}

export function referralConstraintName(error: ReferralWriteError): string | null {
  const text = [error.message, error.details, error.hint]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n");
  const quoted = text.match(/"(pet_referral_codes_[a-z0-9_]+)"/);
  if (quoted) return quoted[1];
  const bare = text.match(/\b(pet_referral_codes_[a-z0-9_]+_key)\b/);
  return bare?.[1] ?? null;
}

function sqlState(error: ReferralWriteError) {
  return error.code == null ? "" : String(error.code).trim();
}

function isUniqueViolationSignal(error: ReferralWriteError) {
  const code = sqlState(error);
  return code === "" || code === "23505" || code === "409";
}

function mentionsNormalizedKey(error: ReferralWriteError) {
  const text = [error.message, error.details, error.hint]
    .filter((part): part is string => typeof part === "string")
    .join("\n");
  return /key \(referral_code_normalized\)/i.test(text);
}

export function isNormalizedReferralCodeCollision(error: ReferralWriteError) {
  if (!isUniqueViolationSignal(error)) return false;
  if (referralConstraintName(error) === REFERRAL_CODE_NORMALIZED_CONSTRAINT) {
    return true;
  }
  return (
    sqlState(error) === "23505" &&
    mentionsNormalizedKey(error) &&
    referralConstraintName(error) !== REFERRAL_CODE_PET_CONSTRAINT
  );
}

export function isPetReferralCodeRowCollision(error: ReferralWriteError) {
  if (!isUniqueViolationSignal(error)) return false;
  return referralConstraintName(error) === REFERRAL_CODE_PET_CONSTRAINT;
}

/**
 * Insert candidates until the normalized code is unique.
 * Only the normalized-code unique constraint is retried. Other database
 * errors stop the loop and are returned to the caller to log.
 */
export async function allocateUniqueReferralCode(input: {
  base: string;
  maxAttempts?: number;
  insertCandidate: (candidate: {
    code: string;
    normalized: string;
  }) => Promise<{ ok: true } | { ok: false; error: ReferralWriteError }>;
}): Promise<ReferralAllocation> {
  const maxAttempts = input.maxAttempts ?? REFERRAL_CODE_MAX_ATTEMPTS;
  let lastCollision: ReferralWriteError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const code = nextReferralCodeCandidate(input.base, attempt);
    const normalized = normalizeReferralCode(code);
    let result: { ok: true } | { ok: false; error: ReferralWriteError };
    try {
      result = await input.insertCandidate({ code, normalized });
    } catch (error) {
      const writeError = toReferralWriteError(error);
      if (isNormalizedReferralCodeCollision(writeError)) {
        lastCollision = writeError;
        continue;
      }
      if (isPetReferralCodeRowCollision(writeError)) {
        return { ok: false, reason: "pet_row_exists", error: writeError };
      }
      return { ok: false, reason: "database", error: writeError };
    }

    if (result.ok) return { ok: true, code };
    if (isNormalizedReferralCodeCollision(result.error)) {
      lastCollision = result.error;
      continue;
    }
    if (isPetReferralCodeRowCollision(result.error)) {
      return { ok: false, reason: "pet_row_exists", error: result.error };
    }
    return { ok: false, reason: "database", error: result.error };
  }

  return { ok: false, reason: "exhausted", error: lastCollision };
}

export async function ensurePetReferralCodeFromStore(
  store: ReferralCodeStore,
  input: {
    petId: string;
    petName: string;
    ownerCustomerId: string;
  },
): Promise<string | null> {
  try {
    const existing = await store.findByPetId(input.petId);
    if (existing?.referral_code) return existing.referral_code;

    const profile = await store.findOwnerName(input.ownerCustomerId);
    const base = buildReferralCodeBase({
      petName: input.petName,
      ownerFirstName: profile?.first_name ?? "",
      ownerLastName: profile?.last_name ?? "",
    });

    const allocated = await allocateUniqueReferralCode({
      base,
      insertCandidate: ({ code, normalized }) =>
        store.insert({
          pet_id: input.petId,
          owner_customer_id: input.ownerCustomerId,
          referral_code: code,
          referral_code_normalized: normalized,
          is_active: true,
        }),
    });

    if (allocated.ok) return allocated.code;

    if (allocated.reason === "pet_row_exists") {
      const again = await store.findByPetId(input.petId);
      if (again?.referral_code) return again.referral_code;
    }

    console.error("ensurePetReferralCode failed:", {
      petId: input.petId,
      ownerCustomerId: input.ownerCustomerId,
      reason: allocated.reason,
      ...describeReferralWriteError(allocated.error),
    });
    return null;
  } catch (error) {
    console.error(
      "ensurePetReferralCode failed:",
      describeReferralWriteError(toReferralWriteError(error)),
    );
    return null;
  }
}

/** Referral codes are optional. A failure here must not undo the saved pet or booking. */
export async function keepPrimaryIfReferralFails<T>(
  primary: T,
  assignReferralCode: () => Promise<unknown>,
): Promise<T> {
  try {
    await assignReferralCode();
  } catch (error) {
    console.error(
      "referral code assignment failed after primary save:",
      describeReferralWriteError(toReferralWriteError(error)),
    );
  }
  return primary;
}

export function referralClientErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    console.error("referral client response sanitized:", error.message);
  }
  return REFERRAL_CLIENT_ERROR;
}

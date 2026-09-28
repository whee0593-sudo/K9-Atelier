import { isFrozenAuthUser } from "@/lib/auth/frozen-account";
import { associateCommunicationByPhone, getConversationRecord } from "@/lib/communication/store";
import { mapValidatedInputToInsertRow } from "@/lib/pets/map";
import { PetValidationError, validateCreatePetInput } from "@/lib/pets/validation";
import {
  ProfileValidationError,
  validateEmailAddress,
} from "@/lib/profiles/validation";
import { phonesMatch } from "@/lib/sms/phone";
import { getStaffSession } from "@/lib/staff/auth";
import { isOwnerEmail, normalizeStaffEmail } from "@/lib/staff/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readName(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new ProfileValidationError(`${field} is required.`, field);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) {
    throw new ProfileValidationError(`${field} is required.`, field);
  }
  return trimmed;
}

function readOptionalPet(body: Record<string, unknown>) {
  const name = typeof body.petName === "string" ? body.petName.trim() : "";
  const breed = typeof body.petBreed === "string" ? body.petBreed.trim() : "";
  const weight = body.petWeightLbs;
  const weightText = typeof weight === "string" ? weight.trim() : weight;
  const hasPet = Boolean(name || breed || (weightText != null && weightText !== ""));
  if (!hasPet) return null;
  try {
    return validateCreatePetInput({
      name,
      breed,
      weightLbs: weightText,
    });
  } catch (error) {
    if (error instanceof PetValidationError) {
      throw new ProfileValidationError(error.message, error.field);
    }
    throw error;
  }
}

async function isStaffAccount(userId: string, email: string) {
  if (isOwnerEmail(email)) return true;
  const admin = createAdminClient();
  const { data } = await admin
    .schema("private")
    .from("staff_members")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function createCommunicationCustomer(input: {
  conversationId: string;
  body: unknown;
}) {
  const session = await getStaffSession();
  if ("error" in session) return session;
  if (!hasSupabaseAdminConfig()) return { error: "misconfigured" as const };
  if (!UUID_PATTERN.test(input.conversationId)) return { error: "not_found" as const };

  const conversation = await getConversationRecord(input.conversationId);
  if (!conversation) return { error: "not_found" as const };
  if (conversation.customer_id) {
    return {
      error: "conflict" as const,
      message: "This number is already linked to a customer.",
    };
  }

  const record =
    input.body != null && typeof input.body === "object" && !Array.isArray(input.body)
      ? (input.body as Record<string, unknown>)
      : {};
  const firstName = readName(record.firstName, "First Name");
  const lastName = readName(record.lastName, "Last Name");
  const email = validateEmailAddress(record.email);
  const pet = readOptionalPet(record);
  const phone = conversation.phone_number;

  const admin = createAdminClient();
  const { data: existingProfile, error: lookupError } = await admin
    .from("profiles")
    .select("id, phone")
    .ilike("email", email)
    .maybeSingle();
  if (lookupError) {
    console.error("createCommunicationCustomer lookup failed:", lookupError.message);
    return { error: "server" as const };
  }

  let customerId: string;
  let created = false;

  if (existingProfile?.id) {
    customerId = existingProfile.id as string;
    const { data: authData } = await admin.auth.admin.getUserById(customerId);
    if (isFrozenAuthUser(authData.user ?? null)) {
      return {
        error: "conflict" as const,
        message: "That customer account is frozen. Unfreeze it before linking.",
      };
    }
    if (await isStaffAccount(customerId, email)) {
      return {
        error: "conflict" as const,
        message: "That email belongs to a staff account.",
      };
    }
    const existingPhone = String(existingProfile.phone ?? "").trim();
    if (existingPhone && !phonesMatch(existingPhone, phone)) {
      return {
        error: "conflict" as const,
        message: "That email is already used by another account.",
      };
    }
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone,
      },
      app_metadata: {
        staff_created: true,
        unclaimed: true,
        created_from_communication: true,
      },
    });
    if (error || !data.user) {
      console.error("createCommunicationCustomer createUser failed:", error?.message);
      if (error && /already been registered|already exists/i.test(error.message)) {
        return {
          error: "conflict" as const,
          message: "That email is already used by another account.",
        };
      }
      return { error: "server" as const };
    }
    customerId = data.user.id;
    created = true;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      email: normalizeStaffEmail(email),
      phone,
    })
    .eq("id", customerId);
  if (profileError) {
    console.error("createCommunicationCustomer profile failed:", profileError.message);
    return { error: "server" as const };
  }

  if (pet) {
    const { data: petRow, error: petError } = await admin
      .from("pets")
      .insert({
        customer_id: customerId,
        ...mapValidatedInputToInsertRow(pet),
      })
      .select("id")
      .single();
    if (petError || !petRow) {
      console.error("createCommunicationCustomer pet failed:", petError?.message);
      return { error: "server" as const };
    }
    try {
      const { ensurePetReferralCode } = await import("@/lib/referrals/service");
      await ensurePetReferralCode({
        petId: petRow.id as string,
        petName: pet.name,
        ownerCustomerId: customerId,
      });
    } catch (error) {
      console.error("createCommunicationCustomer referral code failed:", error);
    }
  }

  await associateCommunicationByPhone(customerId, phone);
  return { customerId, created };
}

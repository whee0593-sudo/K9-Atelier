import { isFrozenAuthUser } from "@/lib/auth/frozen-account";
import { isRegisteredEmailFrozen } from "@/lib/auth/frozen-lookup";
import type { BookingRegisterInput } from "@/lib/booking/register-input";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

export type BookingRegisterResult =
  | { ok: true }
  | {
      error: "conflict" | "frozen" | "misconfigured" | "server";
      message: string;
    };

function isDuplicateAuthEmail(message: string) {
  return /already been registered|already exists|email address is already/i.test(
    message,
  );
}

export async function registerBookingCustomer(
  input: BookingRegisterInput,
): Promise<BookingRegisterResult> {
  if (!hasSupabaseAdminConfig()) {
    return {
      error: "misconfigured",
      message: "Account setup is not available right now. Please try again shortly.",
    };
  }

  if (await isRegisteredEmailFrozen(input.email)) {
    return {
      error: "frozen",
      message:
        "This email belongs to a frozen account. Please contact the Atelier for help.",
    };
  }

  const admin = createAdminClient();
  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", input.email)
    .maybeSingle();

  if (profileLookupError) {
    console.error(
      "registerBookingCustomer profile lookup failed:",
      profileLookupError.message,
    );
    return {
      error: "server",
      message: "Could not create your account. Please try again.",
    };
  }

  if (existingProfile?.id) {
    const { data } = await admin.auth.admin.getUserById(existingProfile.id);
    if (isFrozenAuthUser(data.user ?? null)) {
      return {
        error: "frozen",
        message:
          "This email belongs to a frozen account. Please contact the Atelier for help.",
      };
    }
    return {
      error: "conflict",
      message:
        "An account with this email already exists. Please sign in to continue.",
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
    },
    app_metadata: {
      created_from_booking: true,
    },
  });

  if (error || !data.user) {
    if (error && isDuplicateAuthEmail(error.message)) {
      return {
        error: "conflict",
        message:
          "An account with this email already exists. Please sign in to continue.",
      };
    }
    console.error("registerBookingCustomer createUser failed:", error?.message);
    return {
      error: "server",
      message: "Could not create your account. Please try again.",
    };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
    })
    .eq("id", data.user.id);

  if (profileError) {
    console.error(
      "registerBookingCustomer profile update failed:",
      profileError.message,
    );
    return {
      error: "server",
      message: "Could not save your profile. Please try again.",
    };
  }

  return { ok: true };
}

import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { isFrozenAuthUser } from "@/lib/auth/frozen-account";

export async function isRegisteredEmailFrozen(email: string) {
  if (!hasSupabaseAdminConfig()) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", normalized)
      .maybeSingle();
    if (!profile?.id) return false;

    const { data } = await admin.auth.admin.getUserById(profile.id);
    return isFrozenAuthUser(data.user ?? null);
  } catch (error) {
    console.error("isRegisteredEmailFrozen failed:", error);
    return false;
  }
}

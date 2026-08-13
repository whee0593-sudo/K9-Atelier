import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/pets/auth";

export type StaffSessionResult =
  | { user: User }
  | { error: "unauthenticated" }
  | { error: "forbidden" };

export async function isStaffUser(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_staff_user");

  if (error) {
    console.error("isStaffUser failed:", error.code, error.message);
    return false;
  }

  return data === true;
}

export async function getStaffSession(): Promise<StaffSessionResult> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };
  if (!(await isStaffUser())) return { error: "forbidden" };
  return { user };
}

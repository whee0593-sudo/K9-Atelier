import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/pets/auth";
import { isOwnerEmail } from "@/lib/staff/owner";

export type StaffSessionResult =
  | { user: User }
  | { error: "unauthenticated" }
  | { error: "forbidden" };

export async function isStaffUser(): Promise<boolean> {
  const user = await requireAuthenticatedUser();
  if (!user) return false;
  if (isOwnerEmail(user.email)) return true;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_staff_user");

  if (error) {
    console.error("isStaffUser failed:", error.code, error.message);
    return false;
  }

  return data === true;
}

export async function isOwnerUser(): Promise<boolean> {
  const user = await requireAuthenticatedUser();
  if (!user) return false;
  if (isOwnerEmail(user.email)) return true;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_owner_user");
  if (error) {
    console.error("isOwnerUser failed:", error.code, error.message);
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

export async function getOwnerSession(): Promise<StaffSessionResult> {
  const session = await getStaffSession();
  if ("error" in session) return session;
  if (!(await isOwnerUser())) return { error: "forbidden" };
  return session;
}

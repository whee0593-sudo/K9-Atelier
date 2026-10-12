import { isOwnerEmail } from "@/lib/staff/owner";

export type HeaderAccountDestination = {
  href: "/login" | "/account" | "/admin";
  label: "Login" | "My Account";
};

/** Staff matches isStaffUser: owner email, or is_staff_user. Page path is not used. */
export function headerAccountDestination(input: {
  user: { email?: string | null } | null;
  isStaff: boolean | null;
}): HeaderAccountDestination {
  if (!input.user) {
    return { href: "/login", label: "Login" };
  }

  if (isOwnerEmail(input.user.email) || input.isStaff === true) {
    return { href: "/admin", label: "My Account" };
  }

  return { href: "/account", label: "My Account" };
}

export async function resolveHeaderAccountDestination(input: {
  getUser: () => Promise<{ email?: string | null } | null>;
  isStaffUser: () => Promise<boolean | null>;
}): Promise<HeaderAccountDestination> {
  const user = await input.getUser();
  if (!user) {
    return headerAccountDestination({ user: null, isStaff: false });
  }

  let isStaff: boolean | null = null;
  try {
    isStaff = await input.isStaffUser();
  } catch {
    isStaff = null;
  }

  return headerAccountDestination({ user, isStaff });
}

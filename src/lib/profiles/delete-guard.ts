import { isOwnerEmail, normalizeStaffEmail } from "@/lib/staff/owner";

export type CustomerDeleteGuardInput = {
  actorUserId: string;
  targetUserId: string;
  targetEmail?: string | null;
  targetIsStaff: boolean;
};

export function customerDeleteBlockReason(
  input: CustomerDeleteGuardInput,
): string | null {
  if (input.actorUserId === input.targetUserId) {
    return "You cannot delete the account you are signed in with.";
  }
  if (isOwnerEmail(input.targetEmail)) {
    return "The owner account cannot be deleted.";
  }
  if (input.targetIsStaff) {
    return "Admin accounts cannot be deleted here. Use Admin Team to remove staff access.";
  }
  return null;
}

export function isProtectedStaffEmail(
  email: string | null | undefined,
  staffEmails: Iterable<string>,
) {
  if (!email) return false;
  if (isOwnerEmail(email)) return true;
  const normalized = normalizeStaffEmail(email);
  for (const staffEmail of staffEmails) {
    if (normalizeStaffEmail(staffEmail) === normalized) return true;
  }
  return false;
}

export function customerDeleteConfirmMessage(label: string) {
  return `Delete ${label}'s account? This removes their login, pet profiles, cards on file, and appointment history. This cannot be undone.`;
}

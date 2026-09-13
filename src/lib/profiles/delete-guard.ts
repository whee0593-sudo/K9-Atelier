import { isOwnerEmail, normalizeStaffEmail } from "@/lib/staff/owner";

export type OwnerAccountAction = "delete" | "freeze";

export type OwnerAccountActionInput = {
  action: OwnerAccountAction;
  actorIsOwner: boolean;
  actorUserId: string;
  targetUserId: string;
  targetEmail?: string | null;
};

export function ownerAccountActionBlockReason(
  input: OwnerAccountActionInput,
): string | null {
  if (!input.actorIsOwner) {
    return input.action === "delete"
      ? "Only the owner can delete accounts."
      : "Only the owner can freeze accounts.";
  }
  if (input.actorUserId === input.targetUserId) {
    return input.action === "delete"
      ? "You cannot delete the account you are signed in with."
      : "You cannot freeze the account you are signed in with.";
  }
  if (isOwnerEmail(input.targetEmail)) {
    return input.action === "delete"
      ? "The owner account cannot be deleted."
      : "The owner account cannot be frozen.";
  }
  return null;
}

export function customerDeleteBlockReason(
  input: Omit<OwnerAccountActionInput, "action">,
) {
  return ownerAccountActionBlockReason({ ...input, action: "delete" });
}

export function isAdminAccountEmail(
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

export function customerFreezeConfirmMessage(label: string, frozen: boolean) {
  return frozen
    ? `Unfreeze ${label}'s account? They will be able to sign in again.`
    : `Freeze ${label}'s account? They will not be able to sign in until you unfreeze it.`;
}

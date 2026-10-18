export type PolicyFeeAction = "cancel" | "reschedule" | "remove_dog" | "no_show";

export function policyFeeIdempotencyKey(input: {
  action: PolicyFeeAction;
  visitId: string;
  appointmentId?: string | null;
  fromDate?: string | null;
  fromSlot?: number | null;
  toDate?: string | null;
  toSlot?: number | null;
  reopenId?: string | null;
}) {
  const base =
    input.action === "remove_dog"
      ? `remove_dog:appointment:${input.appointmentId}`
      : input.action === "reschedule"
        ? `reschedule:visit:${input.visitId}:from:${input.fromDate}:${input.fromSlot ?? "na"}:to:${input.toDate}:${input.toSlot ?? "na"}`
        : input.action === "cancel"
          ? `cancel:visit:${input.visitId}`
          : `no_show:visit:${input.visitId}`;
  return input.reopenId ? `${base}:reopen:${input.reopenId}` : base;
}

export function policyFeeForfeitsService(action: PolicyFeeAction) {
  return action !== "reschedule";
}

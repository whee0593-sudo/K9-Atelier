import {
  resumeAppointmentChange,
  type ChangeRecoveryPayload,
  type LiveAppointment,
} from "@/lib/policy-fees/change-recovery";
import {
  acquirePolicyFeeChange,
  applyPolicyFeeCalendar,
  loadPolicyFeeChangeRecovery,
  markPolicyFeeChangeApplied,
  releasePolicyFeeChange,
} from "@/lib/policy-fees/db";

export async function resumeSavedAppointmentChange(input: {
  claimId: string;
  loadLive: (ids: string[]) => Promise<LiveAppointment[]>;
  planReschedule: (
    payload: ChangeRecoveryPayload,
  ) => Promise<{ ok: true; plan: unknown } | { error: "slot_unavailable" | "server" }>;
  afterWrite?: (payload: ChangeRecoveryPayload) => Promise<void>;
}) {
  return resumeAppointmentChange({
    load: () => loadPolicyFeeChangeRecovery(input.claimId),
    acquire: () => acquirePolicyFeeChange(input.claimId),
    release: () => releasePolicyFeeChange(input.claimId),
    loadLive: input.loadLive,
    plan: input.planReschedule,
    apply: (plan) => applyPolicyFeeCalendar(input.claimId, plan),
    mark: () => markPolicyFeeChangeApplied(input.claimId),
    afterWrite: input.afterWrite,
  });
}

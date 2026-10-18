import {
  changeFeeAmount,
  changeFeePercent,
  type AppointmentChangeAction,
  type ChangeNoticeBand,
} from "@/lib/appointments/change-policy";
import {
  changeFeeBase,
  feeServicePortion,
} from "@/lib/appointments/stored-service-price";
import type { PolicyFeeAction } from "@/lib/policy-fees/keys";
import { policyFeeForfeitsService } from "@/lib/policy-fees/keys";
import { roundPolicyMoney } from "@/lib/policy-fees/amounts";

export type PolicyPriceRow = {
  id: string;
  estimated_total?: number | null;
  service_price?: number | null;
  travel_fee?: number | null;
  add_on_ids?: string[] | null;
  add_on_options?: Record<string, unknown> | null;
};

export type ActiveCoverage = {
  appointmentIds: string[];
  travel: boolean;
};

/**
 * Fees after a cancellation or removed dog include only dogs and travel
 * that are not already covered. A reschedule does not create coverage,
 * and its amount also skips dogs already forfeited so the same service
 * is not billed twice.
 */
export function policyFeeFromRows(input: {
  action: PolicyFeeAction;
  rows: PolicyPriceRow[];
  coverage: ActiveCoverage;
  band: ChangeNoticeBand;
}) {
  const covered = new Set(input.coverage.appointmentIds);
  const remaining = input.rows.filter((row) => !covered.has(row.id));

  for (const row of input.rows) {
    const portion = feeServicePortion(row);
    if (!portion.ok) return { ok: false as const, reason: "price_review" as const };
  }

  const serviceBase = changeFeeBase("remove_dog", remaining);
  if (!serviceBase.ok) return { ok: false as const, reason: "price_review" as const };
  const travelOnTargets = changeFeeBase("cancel", input.rows);
  const serviceOnTargets = changeFeeBase("remove_dog", input.rows);
  if (!travelOnTargets.ok || !serviceOnTargets.ok) {
    return { ok: false as const, reason: "price_review" as const };
  }
  const travelAmount = roundPolicyMoney(
    travelOnTargets.amount - serviceOnTargets.amount,
  );
  const includeTravel =
    input.action !== "remove_dog" && !input.coverage.travel && travelAmount > 0;
  const amountBeforeBand = roundPolicyMoney(
    serviceBase.amount + (includeTravel ? travelAmount : 0),
  );

  const percent =
    input.action === "no_show"
      ? 1
      : changeFeePercent(input.action as AppointmentChangeAction, input.band);
  const computed =
    input.action === "no_show"
      ? amountBeforeBand
      : changeFeeAmount(
          input.action as AppointmentChangeAction,
          amountBeforeBand,
          input.band,
        );

  return {
    ok: true as const,
    computed,
    affectedAppointmentIds: remaining.map((row) => row.id),
    includesTravel: includeTravel,
    forfeit: policyFeeForfeitsService(input.action),
    percent,
  };
}

export type CoverageReleaseEvent =
  | "charge_failed"
  | "waiver_revoked"
  | "refund_completed"
  | "waiver_consumed"
  | "admin_reopen"
  | "legacy_review";

/** A normal refund or a consumed waiver keeps the forfeiture. Only an explicit reopen clears it. */
export function coverageAfterEvent(event: CoverageReleaseEvent) {
  if (event === "charge_failed" || event === "admin_reopen") return "release" as const;
  if (event === "waiver_revoked") return "unchanged" as const;
  return "keep" as const;
}

export function legacyChargeNeedsReview(charge: {
  kind: string;
  status: string;
  claimId: string | null;
  reviewed: boolean;
}) {
  if (charge.reviewed) return false;
  if (charge.claimId) return false;
  if (charge.kind !== "cancellation" && charge.kind !== "no_show") return false;
  return charge.status !== "failed";
}

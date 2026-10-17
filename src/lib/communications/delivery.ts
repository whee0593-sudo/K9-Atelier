import { isCommunicationAccepted, type CommunicationSendResult } from "@/lib/communications/result";
import type { ProviderDelivery } from "@/lib/visits/provider-delivery";

/**
 * Maps one communication-log result onto the visit ledger.
 * accepted and an already-accepted duplicate count as delivered.
 * uncertain, and a claim another worker still holds, must not be retried.
 * A definite rejection may be retried with the same idempotency key.
 */
export function communicationToDelivery(
  result: CommunicationSendResult,
): ProviderDelivery {
  if (isCommunicationAccepted(result)) return "delivered";
  if (
    result.status === "uncertain" ||
    result.duplicateReason === "in_flight"
  ) {
    return "uncertain";
  }
  return "rejected";
}

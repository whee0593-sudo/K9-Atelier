/**
 * What a visit notification may safely do after a provider call.
 * rejected: the provider refused the message, so a later attempt can send.
 * uncertain: the provider may already have accepted it. Do not send again.
 */
export type ProviderDelivery = "delivered" | "rejected" | "uncertain";

export function classifyProviderHttpStatus(status: number): ProviderDelivery {
  if (status >= 200 && status < 300) return "delivered";
  if (status === 408 || status === 409 || status === 425 || status >= 500) {
    return "uncertain";
  }
  return "rejected";
}

export function normalizeVisitSendResult(
  value: boolean | ProviderDelivery,
): ProviderDelivery {
  if (value === true || value === "delivered") return "delivered";
  if (value === false || value === "rejected") return "rejected";
  return "uncertain";
}

/** One delivered channel is enough. Any uncertain channel blocks a retry. */
export function combineProviderDeliveries(
  outcomes: ProviderDelivery[],
): ProviderDelivery {
  if (outcomes.some((outcome) => outcome === "delivered")) return "delivered";
  if (outcomes.some((outcome) => outcome === "uncertain")) return "uncertain";
  return "rejected";
}

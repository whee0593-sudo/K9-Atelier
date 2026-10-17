export type ProviderAttemptResult =
  | { outcome: "accepted"; providerMessageId: string | null }
  | { outcome: "rejected"; errorMessage: string }
  | { outcome: "uncertain"; errorMessage: string };

/**
 * 2xx was accepted.
 * 408, 409, and 5xx do not prove the provider rejected the message.
 * Other 4xx responses are a definite rejection and may be retried later.
 */
export function classifyProviderHttpStatus(
  status: number,
): "accepted" | "rejected" | "uncertain" {
  if (!Number.isInteger(status) || status <= 0) return "uncertain";
  if (status >= 200 && status < 300) return "accepted";
  if (status === 408 || status === 409 || status >= 500) return "uncertain";
  return "rejected";
}

export function providerHttpResult(input: {
  status: number;
  raw: string;
  providerMessageId?: string | null;
}): ProviderAttemptResult {
  const outcome = classifyProviderHttpStatus(input.status);
  if (outcome === "accepted") {
    return {
      outcome,
      providerMessageId: input.providerMessageId ?? null,
    };
  }
  const errorMessage = `${input.status} ${input.raw}`.slice(0, 500);
  if (outcome === "uncertain") return { outcome, errorMessage };
  return { outcome: "rejected", errorMessage };
}

export function uncertainProviderError(error: unknown): ProviderAttemptResult {
  return {
    outcome: "uncertain",
    errorMessage:
      error instanceof Error ? error.message : "provider result is unknown",
  };
}

import { idempotencyKeyHash } from "@/lib/communications/idempotency";
import type {
  CommunicationSnapshot,
  CommunicationStore,
  DispatchOutcome,
  ProviderSendResult,
} from "@/lib/communications/store";

export type DispatchMerchantChannelInput = {
  store: CommunicationStore;
  snapshot: CommunicationSnapshot;
  /**
   * Present when this channel must be recorded and not sent.
   * The snapshot intendedStatus is skipped.
   */
  skip?: boolean;
  send?: () => Promise<ProviderSendResult>;
};

function alertMessage(snapshot: CommunicationSnapshot) {
  const fingerprint = snapshot.idempotencyKey.includes("|fp:")
    ? snapshot.idempotencyKey.split("|fp:").slice(1).join("|fp:")
    : "-";
  return `v=${snapshot.visitId} t=${snapshot.notificationType} c=${snapshot.channel} fp=${fingerprint}`;
}

async function claimWithOneRetry(
  store: CommunicationStore,
  snapshot: CommunicationSnapshot,
): Promise<
  | { kind: "claimed"; result: Awaited<ReturnType<CommunicationStore["claim"]>> }
  | { kind: "deferred" }
  | { kind: "unrecorded" }
> {
  try {
    return { kind: "claimed", result: await store.claim(snapshot) };
  } catch {
    console.error(
      "MERCHANT_NOTIFY_CLAIM_FAILED",
      idempotencyKeyHash(snapshot.idempotencyKey),
      snapshot.visitId,
      snapshot.notificationType,
      snapshot.channel,
    );
    const alertOk = await store
      .recordAlert({
        code: "claim_unavailable",
        message: alertMessage(snapshot),
        idempotencyKeyHash: idempotencyKeyHash(snapshot.idempotencyKey),
      })
      .catch(() => false);
    try {
      return { kind: "claimed", result: await store.claim(snapshot) };
    } catch {
      if (alertOk) return { kind: "deferred" };
      console.error(
        "MERCHANT_NOTIFY_UNRECORDED",
        idempotencyKeyHash(snapshot.idempotencyKey),
        snapshot.visitId,
        snapshot.notificationType,
        snapshot.channel,
      );
      return { kind: "unrecorded" };
    }
  }
}

/**
 * Send one merchant channel after a durable claim.
 * A failed log write never calls the provider.
 * A second claim of an accepted or in-flight row never calls it either.
 * Accepted means the provider took the message. It is not marked delivered.
 */
export async function dispatchMerchantChannel(
  input: DispatchMerchantChannelInput,
): Promise<DispatchOutcome> {
  const attempt = await claimWithOneRetry(input.store, input.snapshot);
  if (attempt.kind === "deferred") return "deferred";
  if (attempt.kind === "unrecorded") return "unrecorded";

  const claimed = attempt.result;
  if (claimed.action === "duplicate") return "duplicate";
  if (claimed.action === "unresolved") return "uncertain";
  if (claimed.action === "recorded") return "skipped";

  if (!input.send || input.snapshot.intendedStatus === "skipped") {
    return "skipped";
  }

  let provider: ProviderSendResult;
  try {
    provider = await input.send();
  } catch (error) {
    provider = {
      outcome: "uncertain",
      error: error instanceof Error ? error.message : "provider threw",
    };
  }

  const saved = await input.store.complete({
    id: claimed.id,
    claimToken: claimed.claimToken,
    status: provider.outcome,
    providerMessageId:
      provider.outcome === "accepted" ? provider.providerMessageId : null,
    errorMessage: provider.outcome === "accepted" ? null : provider.error,
  });

  if (!saved) {
    await input.store
      .recordAlert({
        code: "outcome_unresolved",
        message: alertMessage(input.snapshot),
        idempotencyKeyHash: idempotencyKeyHash(input.snapshot.idempotencyKey),
        logId: claimed.id,
      })
      .catch(() => false);
    return "uncertain";
  }

  return provider.outcome;
}

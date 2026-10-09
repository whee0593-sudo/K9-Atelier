import { randomUUID } from "node:crypto";
import { redactCommunicationSecrets, redactOptional } from "@/lib/communications/redact";
import {
  emptyCommunicationResult,
  type CommunicationSendResult,
} from "@/lib/communications/result";
import { createSupabaseCommunicationLogStore } from "@/lib/communications/supabase-store";
import type { CommunicationLogStore } from "@/lib/communications/store";
import type {
  CommunicationChannel,
  CommunicationContext,
  CommunicationProvider,
  CommunicationSnapshot,
} from "@/lib/communications/types";
import {
  COMMUNICATION_ALERT_WRITE_FAILED,
  COMMUNICATION_LOG_STATUS_UPDATE_FAILED,
  COMMUNICATION_LOG_WRITE_FAILED,
  COMMUNICATION_PROVIDER_ID_MISSING,
} from "@/lib/communications/types";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

export type ProviderSendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; errorMessage: string };

export type DispatchCommunicationInput = {
  channel: CommunicationChannel;
  provider: CommunicationProvider;
  recipient: string;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  replyTo?: string | null;
  context?: CommunicationContext | null;
  configured: boolean;
  recipientValid: boolean;
  send: (snapshot: CommunicationSnapshot) => Promise<ProviderSendResult>;
  now?: Date;
  store?: CommunicationLogStore;
};

let storeOverride: CommunicationLogStore | null = null;

export function setCommunicationLogStoreForTests(
  store: CommunicationLogStore | null,
) {
  storeOverride = store;
}

function activeStore(explicit?: CommunicationLogStore) {
  if (explicit) return explicit;
  if (storeOverride) return storeOverride;
  if (!hasSupabaseAdminConfig()) return null;
  return createSupabaseCommunicationLogStore();
}

function logEvent(
  code: string,
  message: string,
  details: { logId?: string | null; idempotencyKey?: string | null },
) {
  console.error(
    JSON.stringify({
      event: code,
      message,
      logId: details.logId ?? null,
      idempotencyKey: details.idempotencyKey ?? null,
    }),
  );
}

async function raiseAlert(
  store: CommunicationLogStore | null,
  code: string,
  message: string,
  details: { logId?: string | null; idempotencyKey?: string | null },
) {
  logEvent(code, message, details);
  if (!store) {
    logEvent(
      COMMUNICATION_ALERT_WRITE_FAILED,
      "No communication log store is configured, so the admin alert row was not written.",
      details,
    );
    return;
  }
  try {
    const recorded = await store.recordAlert({
      code,
      message,
      logId: details.logId ?? null,
      idempotencyKey: details.idempotencyKey ?? null,
    });
    if (!recorded.ok) {
      logEvent(
        COMMUNICATION_ALERT_WRITE_FAILED,
        recorded.error,
        details,
      );
    }
  } catch (error) {
    logEvent(
      COMMUNICATION_ALERT_WRITE_FAILED,
      error instanceof Error ? error.message : "alert write threw",
      details,
    );
  }
}

function buildSnapshot(input: DispatchCommunicationInput): CommunicationSnapshot {
  const context = input.context;
  const idempotencyKey =
    context?.idempotencyKey?.trim() || `unspecified|${randomUUID()}`;
  return {
    channel: input.channel,
    provider: input.provider,
    notificationType: context?.notificationType?.trim() || "unspecified",
    audience: context?.audience ?? "customer",
    customerId: context?.customerId ?? null,
    visitId: context?.visitId ?? null,
    appointmentIds: context?.appointmentIds ?? [],
    petIds: context?.petIds ?? [],
    recipient: redactCommunicationSecrets(input.recipient.trim()),
    subject: redactOptional(input.subject),
    bodyText: redactCommunicationSecrets(input.bodyText),
    bodyHtml: redactOptional(input.bodyHtml),
    replyTo: redactOptional(input.replyTo),
    idempotencyKey,
  };
}

function skippedResult(
  input: DispatchCommunicationInput,
  logId: string | null,
  reason: "missing_config" | "invalid_recipient",
  logError: string | null,
): CommunicationSendResult {
  return emptyCommunicationResult({
    status: "skipped",
    skipReason: reason,
    provider: input.provider,
    logId,
    logError,
    errorMessage:
      reason === "missing_config"
        ? `${input.provider} is not configured`
        : "recipient is missing or invalid",
  });
}

export async function dispatchCommunication(
  input: DispatchCommunicationInput,
): Promise<CommunicationSendResult> {
  const now = input.now ?? new Date();
  const snapshot = buildSnapshot(input);
  const store = activeStore(input.store);
  const alertDetails = { idempotencyKey: snapshot.idempotencyKey };

  try {
    if (!input.recipientValid || !input.configured) {
      const reason = !input.recipientValid
        ? "invalid_recipient"
        : "missing_config";
      if (!store) {
        await raiseAlert(
          null,
          COMMUNICATION_LOG_WRITE_FAILED,
          "Skipped send could not be stored because the log database is not configured.",
          alertDetails,
        );
        return skippedResult(input, null, reason, "log store unavailable");
      }
      const claimed = await store.claim({
        snapshot,
        status: "skipped",
        skipReason: reason,
        errorMessage: skippedResult(input, null, reason, null).errorMessage,
        now,
      });
      if (claimed.action === "log_failed") {
        await raiseAlert(store, COMMUNICATION_LOG_WRITE_FAILED, claimed.error, alertDetails);
        return skippedResult(input, null, reason, claimed.error);
      }
      if (claimed.action === "duplicate_accepted") {
        return emptyCommunicationResult({
          status: "duplicate",
          duplicateReason: "already_accepted",
          provider: input.provider,
          providerMessageId: claimed.providerMessageId,
          logId: claimed.logId,
        });
      }
      if (claimed.action === "in_flight") {
        return emptyCommunicationResult({
          status: "duplicate",
          duplicateReason: "in_flight",
          provider: input.provider,
          logId: claimed.logId,
        });
      }
      return skippedResult(
        input,
        claimed.logId,
        claimed.action === "terminal_skip"
          ? (claimed.skipReason ?? reason)
          : reason,
        null,
      );
    }

    let outbound = snapshot;
    let logId: string | null = null;
    let claimToken: string | null = null;
    let logError: string | null = null;

    if (!store) {
      logError = "log store unavailable";
      await raiseAlert(
        null,
        COMMUNICATION_LOG_WRITE_FAILED,
        "Send continued without a snapshot because the log database is not configured.",
        alertDetails,
      );
    } else {
      const claimed = await store.claim({
        snapshot,
        status: "pending",
        skipReason: null,
        errorMessage: null,
        now,
      });
      if (claimed.action === "log_failed") {
        logError = claimed.error;
        await raiseAlert(store, COMMUNICATION_LOG_WRITE_FAILED, claimed.error, alertDetails);
      } else if (claimed.action === "duplicate_accepted") {
        return emptyCommunicationResult({
          status: "duplicate",
          duplicateReason: "already_accepted",
          provider: input.provider,
          providerMessageId: claimed.providerMessageId,
          logId: claimed.logId,
        });
      } else if (claimed.action === "in_flight") {
        return emptyCommunicationResult({
          status: "duplicate",
          duplicateReason: "in_flight",
          provider: input.provider,
          logId: claimed.logId,
        });
      } else if (claimed.action === "terminal_skip") {
        return skippedResult(
          input,
          claimed.logId,
          claimed.skipReason ?? "invalid_recipient",
          null,
        );
      } else {
        outbound = claimed.snapshot;
        logId = claimed.logId;
        claimToken = claimed.claimToken;
      }
    }

    let providerResult: ProviderSendResult;
    try {
      providerResult = await input.send(outbound);
    } catch (error) {
      providerResult = {
        ok: false,
        errorMessage: error instanceof Error ? error.message : "provider threw",
      };
    }

    const safeError = redactCommunicationSecrets(
      providerResult.ok ? "" : providerResult.errorMessage,
    ).slice(0, 500);

    if (store && logId && claimToken) {
      if (providerResult.ok) {
        const marked = await store.markAccepted({
          logId,
          claimToken,
          providerMessageId: providerResult.providerMessageId,
          now,
        });
        if (!marked.ok) {
          logError = marked.error;
          await raiseAlert(
            store,
            COMMUNICATION_LOG_STATUS_UPDATE_FAILED,
            marked.error,
            { ...alertDetails, logId },
          );
        } else if (!providerResult.providerMessageId) {
          await raiseAlert(
            store,
            COMMUNICATION_PROVIDER_ID_MISSING,
            `${input.provider} accepted the message without a message id.`,
            { ...alertDetails, logId },
          );
        }
      } else {
        const marked = await store.markFailed({
          logId,
          claimToken,
          errorMessage: safeError || "provider rejected the message",
          now,
        });
        if (!marked.ok) {
          logError = marked.error;
          await raiseAlert(
            store,
            COMMUNICATION_LOG_STATUS_UPDATE_FAILED,
            marked.error,
            { ...alertDetails, logId },
          );
        }
      }
    }

    if (!providerResult.ok) {
      return emptyCommunicationResult({
        status: "failed",
        provider: input.provider,
        logId,
        errorMessage: safeError || "provider rejected the message",
        logError,
      });
    }

    return emptyCommunicationResult({
      status: "accepted",
      provider: input.provider,
      providerMessageId: providerResult.providerMessageId,
      logId,
      logError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "dispatch failed";
    await raiseAlert(store, COMMUNICATION_LOG_WRITE_FAILED, message, alertDetails);
    try {
      const providerResult = await input.send(snapshot);
      if (!providerResult.ok) {
        return emptyCommunicationResult({
          status: "failed",
          provider: input.provider,
          errorMessage: redactCommunicationSecrets(providerResult.errorMessage).slice(0, 500),
          logError: message,
        });
      }
      return emptyCommunicationResult({
        status: "accepted",
        provider: input.provider,
        providerMessageId: providerResult.providerMessageId,
        logError: message,
      });
    } catch (sendError) {
      return emptyCommunicationResult({
        status: "failed",
        provider: input.provider,
        errorMessage:
          sendError instanceof Error ? sendError.message : "provider threw",
        logError: message,
      });
    }
  }
}

import { randomUUID } from "node:crypto";
import {
  communicationAlertKey,
  safeAlertMessage,
} from "@/lib/communications/alerts";
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
  COMMUNICATION_PENDING_EXPIRED,
  COMMUNICATION_PROVIDER_ID_MISSING,
  COMMUNICATION_SEND_HELD,
} from "@/lib/communications/types";
import type { ProviderAttemptResult } from "@/lib/communications/provider-outcome";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

export type ProviderSendResult = ProviderAttemptResult;

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

type AlertDetails = {
  logId?: string | null;
  idempotencyKey?: string | null;
  notificationType?: string | null;
  channel?: string | null;
  hold?: string | null;
};

function logEvent(code: string, message: string, details: AlertDetails) {
  console.error(
    JSON.stringify({
      event: code,
      message: safeAlertMessage(message),
      logId: details.logId ?? null,
      alertKey: details.idempotencyKey
        ? communicationAlertKey(details.idempotencyKey)
        : null,
      notificationType: details.notificationType ?? null,
      channel: details.channel ?? null,
      hold: details.hold ?? null,
    }),
  );
}

async function raiseAlert(
  store: CommunicationLogStore | null,
  code: string,
  message: string,
  details: AlertDetails,
) {
  const safeMessage = safeAlertMessage(message);
  logEvent(code, safeMessage, details);
  const alertKey = details.idempotencyKey
    ? communicationAlertKey(details.idempotencyKey)
    : null;
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
      message: safeMessage,
      logId: details.logId ?? null,
      idempotencyKey: alertKey,
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

function maySendWithoutSnapshot(input: DispatchCommunicationInput) {
  return input.context?.allowSendWithoutSnapshot === true;
}

function blockedLogResult(
  input: DispatchCommunicationInput,
  logError: string,
): CommunicationSendResult {
  return emptyCommunicationResult({
    status: "failed",
    provider: input.provider,
    errorMessage: "communication log was not saved",
    logError,
  });
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

async function noteHold(
  store: CommunicationLogStore | null,
  snapshot: CommunicationSnapshot,
  logId: string | null,
  hold: "uncertain" | "stale_pending",
) {
  const message =
    hold === "stale_pending"
      ? `${snapshot.channel} ${snapshot.notificationType} stayed pending for more than 2 minutes. Automatic resend is blocked.`
      : `${snapshot.channel} ${snapshot.notificationType} is held because the provider result is uncertain. Automatic resend is blocked.`;
  await raiseAlert(
    store,
    hold === "stale_pending"
      ? COMMUNICATION_PENDING_EXPIRED
      : COMMUNICATION_SEND_HELD,
    message,
    {
      logId,
      idempotencyKey: snapshot.idempotencyKey,
      notificationType: snapshot.notificationType,
      channel: snapshot.channel,
      hold,
    },
  );
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
  const alertDetails = {
    idempotencyKey: snapshot.idempotencyKey,
    notificationType: snapshot.notificationType,
    channel: snapshot.channel,
  };
  let providerAttempted = false;

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
      if (claimed.action === "hold") {
        await noteHold(store, snapshot, claimed.logId, claimed.hold);
        return emptyCommunicationResult({
          status: "uncertain",
          provider: input.provider,
          logId: claimed.logId,
          errorMessage:
            claimed.hold === "stale_pending"
              ? "pending send was not confirmed"
              : "provider result is uncertain",
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
        maySendWithoutSnapshot(input)
          ? "First booking confirmation continued without a saved snapshot."
          : "Send stopped because the communication log could not be saved.",
        alertDetails,
      );
      if (!maySendWithoutSnapshot(input)) {
        return blockedLogResult(input, logError);
      }
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
        if (!maySendWithoutSnapshot(input)) {
          return blockedLogResult(input, logError);
        }
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
      } else if (claimed.action === "hold") {
        await noteHold(store, snapshot, claimed.logId, claimed.hold);
        return emptyCommunicationResult({
          status: "uncertain",
          provider: input.provider,
          logId: claimed.logId,
          errorMessage:
            claimed.hold === "stale_pending"
              ? "pending send was not confirmed"
              : "provider result is uncertain",
        });
      } else {
        outbound = claimed.snapshot;
        logId = claimed.logId;
        claimToken = claimed.claimToken;
      }
    }

    let providerResult: ProviderSendResult;
    try {
      providerAttempted = true;
      providerResult = await input.send(outbound);
    } catch (error) {
      providerResult = {
        outcome: "uncertain",
        errorMessage: error instanceof Error ? error.message : "provider threw",
      };
    }

    const safeError = redactCommunicationSecrets(
      providerResult.outcome === "accepted" ? "" : providerResult.errorMessage,
    ).slice(0, 500);

    if (store && logId && claimToken) {
      try {
        if (providerResult.outcome === "accepted") {
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
        } else if (providerResult.outcome === "uncertain") {
          const marked = await store.markUncertain({
            logId,
            claimToken,
            errorMessage: safeError || "provider result is unknown",
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
      } catch (markError) {
        logError =
          markError instanceof Error ? markError.message : "status update threw";
        await raiseAlert(
          store,
          COMMUNICATION_LOG_STATUS_UPDATE_FAILED,
          logError,
          { ...alertDetails, logId },
        );
      }
    }

    if (providerResult.outcome === "uncertain") {
      await noteHold(store, outbound, logId, "uncertain");
      return emptyCommunicationResult({
        status: "uncertain",
        provider: input.provider,
        logId,
        errorMessage: safeError || "provider result is unknown",
        logError,
      });
    }

    if (providerResult.outcome === "rejected") {
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
    if (providerAttempted) {
      await noteHold(store, snapshot, null, "uncertain");
      return emptyCommunicationResult({
        status: "uncertain",
        provider: input.provider,
        errorMessage: "provider result was not recorded",
        logError: message,
      });
    }
    if (!maySendWithoutSnapshot(input)) {
      return blockedLogResult(input, message);
    }
    try {
      const providerResult = await input.send(snapshot);
      if (providerResult.outcome === "uncertain") {
        await noteHold(store, snapshot, null, "uncertain");
        return emptyCommunicationResult({
          status: "uncertain",
          provider: input.provider,
          errorMessage: safeAlertMessage(providerResult.errorMessage),
          logError: message,
        });
      }
      if (providerResult.outcome === "rejected") {
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
        status: "uncertain",
        provider: input.provider,
        errorMessage:
          sendError instanceof Error ? sendError.message : "provider threw",
        logError: message,
      });
    }
  }
}

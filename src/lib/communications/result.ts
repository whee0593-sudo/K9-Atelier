import type {
  CommunicationProvider,
  CommunicationSkipReason,
} from "@/lib/communications/types";

export type CommunicationSendStatus =
  | "accepted"
  | "failed"
  | "skipped"
  | "duplicate";

export type CommunicationDuplicateReason = "already_accepted" | "in_flight";

export type CommunicationSendResult = {
  status: CommunicationSendStatus;
  skipReason: CommunicationSkipReason | null;
  duplicateReason: CommunicationDuplicateReason | null;
  provider: CommunicationProvider | null;
  providerMessageId: string | null;
  logId: string | null;
  errorMessage: string | null;
  /**
   * Set when the snapshot or status row could not be written.
   * The database being unavailable means the snapshot was not saved.
   */
  logError: string | null;
};

export function emptyCommunicationResult(
  patch: Partial<CommunicationSendResult> = {},
): CommunicationSendResult {
  return {
    status: "failed",
    skipReason: null,
    duplicateReason: null,
    provider: null,
    providerMessageId: null,
    logId: null,
    errorMessage: null,
    logError: null,
    ...patch,
  };
}

/**
 * True when the provider accepted this attempt, or an earlier attempt with
 * the same idempotency key was already accepted. In-flight duplicates are
 * not success: the other worker has not finished.
 */
export function isCommunicationAccepted(result: CommunicationSendResult) {
  return (
    result.status === "accepted" ||
    (result.status === "duplicate" &&
      result.duplicateReason === "already_accepted")
  );
}

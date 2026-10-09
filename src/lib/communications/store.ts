import type {
  CommunicationSkipReason,
  CommunicationSnapshot,
  StoredCommunicationLog,
} from "@/lib/communications/types";

export type ClaimSend = {
  action: "send";
  logId: string;
  claimToken: string;
  /** Snapshot that must be sent. On retry this is the stored row, not a new template. */
  snapshot: CommunicationSnapshot;
};

export type ClaimResult =
  | ClaimSend
  | {
      action: "duplicate_accepted";
      logId: string;
      providerMessageId: string | null;
    }
  | { action: "in_flight"; logId: string }
  | {
      action: "terminal_skip";
      logId: string;
      skipReason: CommunicationSkipReason | null;
    }
  | { action: "log_failed"; error: string };

export type CommunicationLogStore = {
  claim(input: {
    snapshot: CommunicationSnapshot;
    status: "pending" | "skipped";
    skipReason: CommunicationSkipReason | null;
    errorMessage: string | null;
    now: Date;
  }): Promise<ClaimResult>;
  markAccepted(input: {
    logId: string;
    claimToken: string;
    providerMessageId: string | null;
    now: Date;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
  markFailed(input: {
    logId: string;
    claimToken: string;
    errorMessage: string;
    now: Date;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
  recordAlert(input: {
    code: string;
    message: string;
    logId: string | null;
    idempotencyKey: string | null;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
  read(logId: string): Promise<StoredCommunicationLog | null>;
};

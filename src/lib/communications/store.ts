export type CommunicationChannel = "email" | "sms";

export type CommunicationLogStatus =
  | "pending"
  | "skipped"
  | "accepted"
  | "failed"
  | "uncertain"
  | "delivered"
  | "undelivered"
  | "bounced";

export type SkipReason = "missing_config" | "invalid_recipient";

export type CommunicationSnapshot = {
  channel: CommunicationChannel;
  notificationType: string;
  customerId: string | null;
  visitId: string;
  appointmentIds: string[];
  petIds: string[];
  recipient: string;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  replyTo: string | null;
  provider: "resend" | "twilio" | null;
  idempotencyKey: string;
  intendedStatus: "pending" | "skipped";
  skipReason: SkipReason | null;
};

export type ClaimResult =
  | { action: "send"; id: string; claimToken: string }
  | { action: "recorded" }
  | { action: "duplicate" }
  | { action: "unresolved" };

export type CommunicationStore = {
  claim(snapshot: CommunicationSnapshot): Promise<ClaimResult>;
  complete(input: {
    id: string;
    claimToken: string;
    status: "accepted" | "failed" | "uncertain";
    providerMessageId: string | null;
    errorMessage: string | null;
  }): Promise<boolean>;
  recordAlert(input: {
    code: string;
    message: string;
    idempotencyKeyHash: string;
    logId?: string | null;
  }): Promise<boolean>;
  listAlerts(
    code: string,
    options?: { excludeIds?: string[] },
  ): Promise<Array<{ id: string; message: string }>>;
  deleteAlert(id: string): Promise<void>;
};

export type ProviderSendResult =
  | { outcome: "accepted"; providerMessageId: string }
  | { outcome: "failed"; error: string }
  | { outcome: "uncertain"; error: string };

export type DispatchOutcome =
  | "accepted"
  | "failed"
  | "uncertain"
  | "skipped"
  | "duplicate"
  | "deferred"
  | "unrecorded";

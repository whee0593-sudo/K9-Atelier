export type CommunicationChannel = "email" | "sms";

export type CommunicationAudience = "customer" | "staff";

export type CommunicationProvider = "resend" | "twilio";

export type CommunicationLogStatus =
  | "pending"
  | "skipped"
  | "accepted"
  | "failed"
  | "uncertain"
  | "delivered"
  | "undelivered"
  | "bounced";

export type CommunicationSkipReason = "missing_config" | "invalid_recipient";

export type CommunicationSnapshot = {
  channel: CommunicationChannel;
  provider: CommunicationProvider;
  notificationType: string;
  audience: CommunicationAudience;
  customerId: string | null;
  visitId: string | null;
  appointmentIds: string[];
  petIds: string[];
  recipient: string;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  replyTo: string | null;
  idempotencyKey: string;
};

export type StoredCommunicationLog = {
  id: string;
  snapshot: CommunicationSnapshot;
  status: CommunicationLogStatus;
  skipReason: CommunicationSkipReason | null;
  providerMessageId: string | null;
  claimToken: string;
  claimedAt: string;
  errorMessage: string | null;
};

/** A pending claim older than this is held and must not be sent again. */
export const COMMUNICATION_CLAIM_STALE_MS = 2 * 60 * 1000;

export type ProviderAttempt =
  | { outcome: "accepted"; providerMessageId: string }
  | { outcome: "failed"; error: string }
  | { outcome: "uncertain"; error: string };

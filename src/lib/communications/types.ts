export type CommunicationChannel = "email" | "sms";

export type CommunicationAudience = "customer" | "staff";

export type CommunicationProvider = "resend" | "twilio";

export type CommunicationLogStatus =
  | "pending"
  | "skipped"
  | "accepted"
  | "failed"
  | "delivered"
  | "undelivered"
  | "bounced";

export type CommunicationSkipReason = "missing_config" | "invalid_recipient";

export type CommunicationContext = {
  notificationType: string;
  audience?: CommunicationAudience;
  customerId?: string | null;
  visitId?: string | null;
  appointmentIds?: string[];
  petIds?: string[];
  /**
   * Stable key for one logical send.
   * A concurrent or repeated call with the same key must not send a second
   * message after the first was accepted.
   */
  idempotencyKey: string;
};

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

export const COMMUNICATION_LOG_WRITE_FAILED = "COMMUNICATION_LOG_WRITE_FAILED";
export const COMMUNICATION_LOG_STATUS_UPDATE_FAILED =
  "COMMUNICATION_LOG_STATUS_UPDATE_FAILED";
export const COMMUNICATION_PROVIDER_ID_MISSING =
  "COMMUNICATION_PROVIDER_ID_MISSING";
export const COMMUNICATION_ALERT_WRITE_FAILED =
  "COMMUNICATION_ALERT_WRITE_FAILED";

/** A pending claim older than this may be taken over by one retry worker. */
export const COMMUNICATION_CLAIM_STALE_MS = 2 * 60 * 1000;

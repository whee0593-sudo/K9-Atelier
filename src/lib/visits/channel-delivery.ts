import {
  runVisitNotification,
  type VisitNotificationResult,
  type VisitNotificationStore,
} from "@/lib/visits/notification-ledger";
import type { ProviderDelivery } from "@/lib/visits/provider-delivery";

export type VisitChannel = "email" | "sms";

/** One visit event keeps a separate row for each channel. */
export function visitChannelEvent(event: string, channel: VisitChannel) {
  return `${event}:${channel}`;
}

export type VisitChannelResult = VisitNotificationResult | "absent";

/**
 * Email and SMS are claimed, sent, and retried on their own.
 * A delivered channel is not sent again. An uncertain channel stays held.
 * A definite rejection releases only that channel.
 */
export async function deliverVisitChannels(input: {
  visitId: string | null | undefined;
  event: string;
  store?: VisitNotificationStore | null;
  email?: () => Promise<boolean | ProviderDelivery>;
  sms?: () => Promise<boolean | ProviderDelivery>;
}): Promise<{ email: VisitChannelResult; sms: VisitChannelResult }> {
  const email = input.email
    ? await runVisitNotification({
        visitId: input.visitId,
        event: visitChannelEvent(input.event, "email"),
        store: input.store,
        send: input.email,
      })
    : "absent";
  const sms = input.sms
    ? await runVisitNotification({
        visitId: input.visitId,
        event: visitChannelEvent(input.event, "sms"),
        store: input.store,
        send: input.sms,
      })
    : "absent";
  return { email, sms };
}

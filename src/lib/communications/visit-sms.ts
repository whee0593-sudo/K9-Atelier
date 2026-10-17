import { deliverTrackedNotice, type DeliveryOutcome } from "@/lib/communications/deliver";
import { visitLogisticsKey } from "@/lib/communications/keys";
import type { CommunicationClaimStore } from "@/lib/communications/store";
import type { ProviderAttempt } from "@/lib/communications/types";
import {
  planVisitLogisticsSms,
  type VisitDogFact,
} from "@/lib/communications/visit-readiness";

export async function deliverVisitLogisticsSms(input: {
  event: "en_route" | "checkout_ready";
  visitId: string;
  dogs: VisitDogFact[];
  customerId: string | null;
  petIds: string[];
  recipient: string;
  body: string;
  store: CommunicationClaimStore;
  send: () => Promise<ProviderAttempt>;
  now?: number;
}): Promise<DeliveryOutcome | "wait" | "already_sent" | "empty"> {
  const plan = planVisitLogisticsSms({ event: input.event, dogs: input.dogs });
  if (plan.action === "empty") return "empty";
  if (plan.action === "wait") return "wait";
  if (plan.action === "already_sent") return "already_sent";
  return deliverTrackedNotice({
    store: input.store,
    now: input.now,
    snapshot: {
      channel: "sms",
      provider: "twilio",
      notificationType: input.event,
      audience: "customer",
      customerId: input.customerId,
      visitId: input.visitId,
      appointmentIds: plan.appointmentIds,
      petIds: input.petIds,
      recipient: input.recipient,
      subject: null,
      bodyText: input.body,
      bodyHtml: null,
      replyTo: null,
      idempotencyKey: visitLogisticsKey(input.visitId, input.event),
    },
    send: input.send,
  });
}

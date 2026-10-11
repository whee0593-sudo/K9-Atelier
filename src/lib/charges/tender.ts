import { formatReceiptPaymentMethod } from "@/lib/charges/receipt-view";
import type { ChargeTender } from "@/lib/charges/types";
import type { PaymentMethodRecord } from "@/lib/payments/types";

export type CollectPaymentChoice =
  | { tender: "cash" }
  | { tender: "zelle" }
  | { tender: "card"; useNewCard: true }
  | { tender: "card"; useNewCard: false; paymentMethodId: string };

export function isCashTender(tender: ChargeTender | null | undefined) {
  return tender === "cash";
}

/** Cash and Zelle are recorded on the visit. They do not create a Stripe charge. */
export function isManualTender(tender: ChargeTender | null | undefined) {
  return tender === "cash" || tender === "zelle";
}

export function buildCollectChargePaymentFields(choice: CollectPaymentChoice) {
  if (choice.tender === "cash" || choice.tender === "zelle") {
    return {
      tender: choice.tender,
      useNewCard: false,
      paymentMethodId: undefined,
    };
  }
  if (choice.useNewCard) {
    return {
      tender: "card" as const,
      useNewCard: true,
      paymentMethodId: undefined,
    };
  }
  return {
    tender: "card" as const,
    useNewCard: false,
    paymentMethodId: choice.paymentMethodId,
  };
}

export function collectReceiptPaymentLabel(input: {
  tender?: ChargeTender | null;
  method?: PaymentMethodRecord | null;
}) {
  if (input.tender === "zelle") return "Zelle";
  if (isCashTender(input.tender)) return "Cash";
  return formatReceiptPaymentMethod(input.method);
}

export function readChargeTender(value: unknown): ChargeTender {
  if (value === "cash" || value === "zelle") return value;
  return "card";
}

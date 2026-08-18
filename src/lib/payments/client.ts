import type { PaymentMethodRecord } from "@/lib/payments/types";

export class PaymentClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PaymentClientError";
    this.status = status;
  }
}

async function readPaymentResponse<T>(response: Response): Promise<T> {
  let body: {
    error?: string;
    methods?: PaymentMethodRecord[];
    method?: PaymentMethodRecord;
    configured?: boolean;
    clientSecret?: string;
    publishableKey?: string;
    ok?: boolean;
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new PaymentClientError(
      body.error ?? "Something went wrong. Please try again.",
      response.status,
    );
  }

  return body as T;
}

export async function fetchCustomerPaymentMethods(): Promise<{
  methods: PaymentMethodRecord[];
  configured: boolean;
}> {
  const response = await fetch("/api/payment-methods", { credentials: "include" });
  return readPaymentResponse(response);
}

export async function createPaymentSetupIntent(): Promise<{
  clientSecret: string;
  publishableKey: string;
}> {
  const response = await fetch("/api/payment-methods/setup-intent", {
    method: "POST",
    credentials: "include",
  });
  return readPaymentResponse(response);
}

export async function savePaymentSetupIntent(
  setupIntentId: string,
): Promise<PaymentMethodRecord> {
  const response = await fetch("/api/payment-methods", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setupIntentId }),
  });
  const body = await readPaymentResponse<{ method: PaymentMethodRecord }>(response);
  return body.method;
}

export async function deleteCustomerPaymentMethod(
  paymentMethodId: string,
): Promise<void> {
  const response = await fetch(`/api/payment-methods/${paymentMethodId}`, {
    method: "DELETE",
    credentials: "include",
  });
  await readPaymentResponse<{ ok: boolean }>(response);
}

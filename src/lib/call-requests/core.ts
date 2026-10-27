export const CALL_REQUEST_CONSENT = "Save my card securely for a future appointment. No charge today.";
export const CALL_REQUEST_CONSENT_VERSION = "2026-10-20";

export class CallRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function callContact(input: unknown) {
  const value = input as Record<string, unknown> | null;
  const name = typeof value?.name === "string" ? value.name.trim().replace(/\s+/g, " ") : "";
  const rawPhone = typeof value?.phone === "string" ? value.phone.trim() : "";
  if (name.length < 2 || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) {
    throw new CallRequestError("Please enter your full name.");
  }
  if (!/^\+?[\d\s().-]+$/.test(rawPhone) || rawPhone.length > 30) {
    throw new CallRequestError("Please enter a valid phone number.");
  }
  const digits = rawPhone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  let phone: string;
  if (!rawPhone.startsWith("+") || digits.startsWith("1")) {
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) throw new CallRequestError("Please enter a valid phone number.");
    phone = `+1${national}`;
  } else {
    if (!/^[2-9]\d{7,14}$/.test(digits) || /^(\d)\1+$/.test(digits)) throw new CallRequestError("Please enter a valid phone number.");
    phone = `+${digits}`;
  }
  if (value?.consent !== true) throw new CallRequestError("Please agree to save your card before continuing.");
  return { name, phone };
}

export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new CallRequestError("Please open this form on our website and try again.", 403);
  }
}

export async function smallJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new CallRequestError("Invalid request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new CallRequestError("Invalid request.");
  const parts: Uint8Array[] = []; let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 4096) { await reader.cancel(); throw new CallRequestError("Request is too large.", 413); }
    parts.push(value);
  }
  try {
    const bytes = new Uint8Array(length); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    return result;
  } catch { throw new CallRequestError("Invalid request."); }
}

type StripeReference = string | { id: string } | null;
const referenceId = (value: StripeReference) => typeof value === "string" ? value : value?.id;

export function verifiedCallCard(
  request: { id: string; stripe_customer_id: string | null; stripe_setup_intent_id: string | null },
  setup: { id: string; status: string; usage: string; customer: StripeReference; payment_method: StripeReference; metadata: Record<string, string> | null },
  method: { id: string; type: string; customer: StripeReference; card?: { brand: string; last4: string; exp_month: number; exp_year: number } | null },
) {
  if (!request.stripe_customer_id || !request.stripe_setup_intent_id || setup.id !== request.stripe_setup_intent_id ||
    setup.status !== "succeeded" || setup.usage !== "off_session" || setup.metadata?.call_request_id !== request.id ||
    referenceId(setup.customer) !== request.stripe_customer_id || referenceId(setup.payment_method) !== method.id ||
    method.customer === null || referenceId(method.customer) !== request.stripe_customer_id || method.type !== "card" || !method.card) {
    throw new CallRequestError("Your card has not been saved yet. Please complete card setup.", 409);
  }
  return { stripe_payment_method_id: method.id, card_brand: method.card.brand, card_last4: method.card.last4,
    card_exp_month: method.card.exp_month, card_exp_year: method.card.exp_year };
}

type CompletionRow = Parameters<typeof verifiedCallCard>[0] & {
  status: string; consent_at: string | null; name: string | null; phone: string | null;
};
export type CallCompletionPorts = {
  loadSetup: (id: string) => Promise<Parameters<typeof verifiedCallCard>[1]>;
  loadMethod: (id: string) => Promise<Parameters<typeof verifiedCallCard>[2]>;
  persist: (card: ReturnType<typeof verifiedCallCard>) => Promise<boolean>;
  alreadyReceived: () => Promise<boolean>;
  notify: () => Promise<void>;
};

/** A Stripe success alone is insufficient: the request must also be durably saved. */
export async function completeStoredCallRequest(row: CompletionRow, ports: CallCompletionPorts) {
  if (row.status !== "draft") return;
  if (!row.consent_at || !row.name || !row.phone || !row.stripe_setup_intent_id) throw new CallRequestError("Please complete your contact and card details.", 409);
  const setup = await ports.loadSetup(row.stripe_setup_intent_id);
  const methodId = referenceId(setup.payment_method);
  if (!methodId) throw new CallRequestError("Please finish saving your card.", 409);
  const card = verifiedCallCard(row, setup, await ports.loadMethod(methodId));
  if (!(await ports.persist(card)) && !(await ports.alreadyReceived())) throw new Error("call_complete_not_saved");
  try { await ports.notify(); } catch { /* Saved requests remain visible in the staff queue; replay is independent. */ }
}

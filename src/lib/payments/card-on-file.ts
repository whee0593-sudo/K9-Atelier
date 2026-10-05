/** Cards saved for a later visit must be merchant-initiated charges. */
export function savedCardChargeConfirmation() {
  return {
    confirm: true as const,
    off_session: true as const,
  };
}

export function offSessionCardSetupParams(customerId: string) {
  return {
    customer: customerId,
    usage: "off_session" as const,
    payment_method_types: ["card" as const],
    payment_method_options: {
      card: {
        request_three_d_secure: "any" as const,
      },
    },
  };
}

export function isCardExpired(
  expMonth: number,
  expYear: number,
  now = new Date(),
) {
  if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12) return true;
  if (!Number.isInteger(expYear) || expYear < 2000) return true;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return true;
  if (year > expYear) return true;
  if (year === expYear && month > expMonth) return true;
  return false;
}

type CardChecks = {
  cvc_check?: string | null;
  address_postal_code_check?: string | null;
} | null;

export function cardSaveRejection(
  card: {
    exp_month: number;
    exp_year: number;
    checks?: CardChecks;
  } | null | undefined,
  now = new Date(),
) {
  if (!card) return "This card could not be verified. Please try another card.";
  if (isCardExpired(card.exp_month, card.exp_year, now)) {
    return "This card is expired. Please use a current card.";
  }
  if (card.checks?.cvc_check === "fail") {
    return "The security code could not be verified. Please check the card and try again.";
  }
  if (card.checks?.address_postal_code_check === "fail") {
    return "The billing postal code could not be verified. Please check the card and try again.";
  }
  return null;
}

export function withoutSetupIntentRedirect(href: string) {
  const url = new URL(href, "http://localhost");
  url.searchParams.delete("setup_intent");
  url.searchParams.delete("setup_intent_client_secret");
  url.searchParams.delete("redirect_status");
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return `${url.origin}${path}`;
  }
  return path;
}

export function readSucceededSetupIntentId(search: string) {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  if (params.get("redirect_status") !== "succeeded") return null;
  const id = params.get("setup_intent")?.trim() ?? "";
  if (!id.startsWith("seti_")) return null;
  return id;
}

export function readOffSessionAuthentication(error: unknown): {
  paymentIntentId: string;
  clientSecret: string;
} | null {
  if (!error || typeof error !== "object") return null;
  const record = error as {
    code?: string;
    payment_intent?: {
      id?: string;
      status?: string;
      client_secret?: string | null;
    };
    raw?: {
      payment_intent?: {
        id?: string;
        status?: string;
        client_secret?: string | null;
      };
    };
  };
  if (record.code !== "authentication_required") return null;
  const intent = record.payment_intent ?? record.raw?.payment_intent;
  if (!intent?.id || !intent.client_secret) return null;
  if (
    intent.status !== "requires_action" &&
    intent.status !== "requires_confirmation"
  ) {
    return null;
  }
  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
  };
}

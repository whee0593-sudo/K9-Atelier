/** Google Ads tag ID from Ads → Goals → Google tag setup. */
export const GOOGLE_ADS_ID = "AW-18402037044";

/** Event snippet label for the Book appointment conversion action. */
export const GOOGLE_ADS_BOOK_CONVERSION_LABEL = "x65RCOrWw-UcELSa48ZE";

const BOOK_APPOINTMENT_VALUE_USD = 90;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function reportBookAppointmentConversion(transactionId?: string) {
  if (
    typeof window === "undefined" ||
    typeof window.gtag !== "function" ||
    !GOOGLE_ADS_BOOK_CONVERSION_LABEL
  ) {
    return;
  }

  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_BOOK_CONVERSION_LABEL}`,
    value: BOOK_APPOINTMENT_VALUE_USD,
    currency: "USD",
    ...(transactionId ? { transaction_id: transactionId } : {}),
  });
}

/** Google Ads tag ID from Ads → Goals → Google tag setup. */
export const GOOGLE_ADS_ID = "AW-18402037044";

/** Conversion label, filled in after the Book appointment action is created. */
export const GOOGLE_ADS_BOOK_CONVERSION_LABEL = "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function reportBookAppointmentConversion() {
  if (
    typeof window === "undefined" ||
    typeof window.gtag !== "function" ||
    !GOOGLE_ADS_BOOK_CONVERSION_LABEL
  ) {
    return;
  }

  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_BOOK_CONVERSION_LABEL}`,
  });
}

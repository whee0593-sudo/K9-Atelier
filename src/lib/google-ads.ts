/** Google Ads tag ID from Ads → Goals → Google tag setup. */
export const GOOGLE_ADS_ID = "AW-18402037044";

/** Event snippet label for the Book appointment conversion action. */
export const GOOGLE_ADS_BOOK_CONVERSION_LABEL = "x65RCOrWw-UcELSa48ZE";

/** Exact Google Ads send_to for the Book appointment conversion. */
export const GOOGLE_ADS_BOOK_CONVERSION_SEND_TO = `${GOOGLE_ADS_ID}/${GOOGLE_ADS_BOOK_CONVERSION_LABEL}`;

/** Browser storage key for appointment IDs that already sent this conversion. */
export const GOOGLE_ADS_BOOK_CONVERSION_STORAGE_KEY =
  "k9-google-ads-book-conversions";

const MAX_TRACKED_IDS = 50;
const GTAG_RETRY_MS = 250;
const GTAG_RETRY_ATTEMPTS = 40;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const inFlightAppointmentIds = new Set<string>();
const retryTimers = new Map<string, number>();
const retryAttempts = new Map<string, number>();

function normalizeAppointmentId(appointmentId: string | undefined): string {
  return appointmentId?.trim() ?? "";
}

export function readTrackedGoogleAdsBookingIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      GOOGLE_ADS_BOOK_CONVERSION_STORAGE_KEY,
    );
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
  } catch {
    return [];
  }
}

function rememberTrackedGoogleAdsBookingId(appointmentId: string) {
  const ids = readTrackedGoogleAdsBookingIds().filter(
    (id) => id !== appointmentId,
  );
  ids.push(appointmentId);
  window.localStorage.setItem(
    GOOGLE_ADS_BOOK_CONVERSION_STORAGE_KEY,
    JSON.stringify(ids.slice(-MAX_TRACKED_IDS)),
  );
}

export function hasTrackedGoogleAdsBookingConversion(
  appointmentId: string,
): boolean {
  const id = normalizeAppointmentId(appointmentId);
  if (!id) return false;
  return readTrackedGoogleAdsBookingIds().includes(id);
}

function clearRetry(appointmentId: string) {
  const timer = retryTimers.get(appointmentId);
  if (timer != null) {
    window.clearInterval(timer);
    retryTimers.delete(appointmentId);
  }
  retryAttempts.delete(appointmentId);
  inFlightAppointmentIds.delete(appointmentId);
}

function fireBookAppointmentConversion(appointmentId: string): boolean {
  if (typeof window.gtag !== "function") return false;
  window.gtag("event", "conversion", {
    send_to: GOOGLE_ADS_BOOK_CONVERSION_SEND_TO,
    transaction_id: appointmentId,
  });
  rememberTrackedGoogleAdsBookingId(appointmentId);
  clearRetry(appointmentId);
  return true;
}

/**
 * Fires the Google Ads Book appointment conversion once per appointment ID
 * in this browser. Safe to call again after a success-page refresh.
 */
export function trackGoogleAdsBookingConversion(appointmentId: string): void {
  if (typeof window === "undefined") return;
  const id = normalizeAppointmentId(appointmentId);
  if (!id) return;
  if (hasTrackedGoogleAdsBookingConversion(id) || inFlightAppointmentIds.has(id)) {
    return;
  }

  inFlightAppointmentIds.add(id);
  if (fireBookAppointmentConversion(id)) return;

  const timer = window.setInterval(() => {
    const attempts = (retryAttempts.get(id) ?? 0) + 1;
    retryAttempts.set(id, attempts);
    if (
      hasTrackedGoogleAdsBookingConversion(id) ||
      fireBookAppointmentConversion(id) ||
      attempts >= GTAG_RETRY_ATTEMPTS
    ) {
      clearRetry(id);
    }
  }, GTAG_RETRY_MS);
  retryTimers.set(id, timer);
}

export function resetGoogleAdsBookingConversionTrackingForTests() {
  if (typeof window !== "undefined") {
    for (const timer of retryTimers.values()) {
      window.clearInterval(timer);
    }
    window.localStorage.removeItem(GOOGLE_ADS_BOOK_CONVERSION_STORAGE_KEY);
  }
  retryTimers.clear();
  retryAttempts.clear();
  inFlightAppointmentIds.clear();
}

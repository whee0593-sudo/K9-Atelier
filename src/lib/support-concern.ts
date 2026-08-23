export const CONCERN_CONTEXT_KEY = "k9-concern-context";
export const CONCERN_SUBMITTED_KEY = "k9-concern-submitted";

export type ConcernContext = {
  appointmentId?: string;
  chargeId?: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function storeConcernContext(context: ConcernContext) {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(CONCERN_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Private browsing can block storage; the form still works without it.
  }
}

export function readConcernContext(): ConcernContext | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(CONCERN_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConcernContext;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function markConcernSubmitted(chargeId?: string) {
  if (!isBrowser() || !chargeId) return;
  try {
    const current = readSubmittedChargeIds();
    current.add(chargeId);
    sessionStorage.setItem(
      CONCERN_SUBMITTED_KEY,
      JSON.stringify(Array.from(current)),
    );
  } catch {
    // Ignore storage failures.
  }
}

export function hasConcernBeenSubmitted(chargeId?: string) {
  if (!chargeId) return false;
  return readSubmittedChargeIds().has(chargeId);
}

function readSubmittedChargeIds() {
  if (!isBrowser()) return new Set<string>();
  try {
    const raw = sessionStorage.getItem(CONCERN_SUBMITTED_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

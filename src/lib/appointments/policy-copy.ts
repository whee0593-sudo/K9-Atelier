/** Customer-facing cancellation policy. Dates are America/New_York calendar days. */
export const CANCELLATION_POLICY_ROWS = [
  ["Two or more calendar days before", "No fee."],
  ["One calendar day before", "50% of the applicable booking total."],
  ["On the day of the appointment", "100%."],
  [
    "No-Show",
    "Groomer arrives, attempts contact, no response within 15 minutes: 100%.",
  ],
] as const;

export const POLICY_CALENDAR_NOTE =
  "These dates are calendar days in Eastern Time (America/New_York).";

export const APPLICABLE_BOOKING_TOTAL_NOTE =
  "The applicable booking total is the confirmed service, priced add-ons, one travel fee, and other charges already saved on the visit. Removing one dog uses that dog's confirmed charges only and does not include the travel fee that stays with the visit. An add-on that has not been priced yet is not included.";

export const NO_SHOW_LIMITS_NOTE =
  "A no-show fee is 100% of that applicable booking total. It is not charged together with a cancellation fee for the same appointment. Being away from home is not, by itself, a no-show. If you have replied, or a handoff was already arranged, the time alone does not make the visit a no-show.";

export const ILLNESS_POLICY_COPY =
  "If your dog is unwell or an unexpected situation arises, please contact us directly as early as possible.";

export function cancellationPolicySummary() {
  return CANCELLATION_POLICY_ROWS.map(([notice, fee]) => `${notice}: ${fee}`).join(
    " ",
  );
}

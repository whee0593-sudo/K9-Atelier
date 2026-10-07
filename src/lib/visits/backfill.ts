/**
 * Historical appointments have no visit_id until the visits migration runs.
 *
 * Only one fact is strong enough to merge them: a shared
 * customer_confirm_token_hash from one staff multi-pet booking.
 * Same customer, date, street, ZIP, or a short gap between created_at
 * values is not evidence. Those rows each become their own visit.
 * A wrong merge is harder to undo than two visits that staff can relate later.
 *
 * No other stored column identifies a multi-pet booking. There is no
 * batch id. Date and address are reused by later visits to the same home.
 */
export type HistoricalVisitReason = "confirm_token" | "unmatched_single";

export type HistoricalAppointment = {
  id: string;
  customerId: string;
  appointmentDate: string;
  addressStreet: string;
  addressZip: string;
  scheduledStart: number | null;
  createdAt: string;
  confirmTokenHash: string | null;
};

export type HistoricalVisitGroup = {
  reason: HistoricalVisitReason;
  appointmentIds: string[];
};

export function historicalAddressKey(input: {
  addressStreet: string;
  addressZip: string;
}) {
  const street = input.addressStreet.trim().toLowerCase();
  const zip = input.addressZip.replace(/\D/g, "").slice(0, 5);
  return `${street}|${zip}`;
}

export function planHistoricalVisits(
  appointments: HistoricalAppointment[],
): HistoricalVisitGroup[] {
  const groups: HistoricalVisitGroup[] = [];
  const consumed = new Set<string>();

  const byToken = new Map<string, HistoricalAppointment[]>();
  for (const appointment of appointments) {
    const token = appointment.confirmTokenHash?.trim();
    if (!token) continue;
    const list = byToken.get(token) ?? [];
    list.push(appointment);
    byToken.set(token, list);
  }
  for (const list of byToken.values()) {
    const ordered = [...list].sort(compareAppointments);
    groups.push({
      reason: "confirm_token",
      appointmentIds: ordered.map((appointment) => appointment.id),
    });
    for (const appointment of ordered) consumed.add(appointment.id);
  }

  const remaining = appointments
    .filter((appointment) => !consumed.has(appointment.id))
    .sort(compareAppointments);
  for (const appointment of remaining) {
    groups.push({
      reason: "unmatched_single",
      appointmentIds: [appointment.id],
    });
  }

  return groups;
}

function compareAppointments(left: HistoricalAppointment, right: HistoricalAppointment) {
  return (
    left.customerId.localeCompare(right.customerId) ||
    left.appointmentDate.localeCompare(right.appointmentDate) ||
    historicalAddressKey(left).localeCompare(historicalAddressKey(right)) ||
    left.createdAt.localeCompare(right.createdAt) ||
    (left.scheduledStart ?? 9999) - (right.scheduledStart ?? 9999) ||
    left.id.localeCompare(right.id)
  );
}

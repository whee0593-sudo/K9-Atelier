/**
 * Historical appointments have no visit_id.
 * Group only when the evidence is strong. Same customer, date, and address
 * is NOT enough: that household can have two separate visits.
 *
 * The SQL migration uses these same rules:
 * 1. A shared customer_confirm_token_hash is one staff multi-pet booking.
 * 2. Otherwise, rows join a cluster only when they share customer, date, and
 *    the exact normalized street|zip key, were created within 15 seconds of
 *    the first row in that cluster, and have strictly increasing start times.
 * 3. Everything else stays its own visit.
 *
 * Street matching is exact after trim/lowercase and a 5-digit ZIP. "Main Street"
 * and "Main St" are left apart on purpose.
 */
export const HISTORICAL_CLUSTER_GAP_MS = 15_000;

export type HistoricalVisitReason =
  | "confirm_token"
  | "consecutive_cluster"
  | "unmatched_single";

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

  let cluster: HistoricalAppointment[] = [];
  const flush = () => {
    if (cluster.length === 0) return;
    groups.push({
      reason: cluster.length > 1 ? "consecutive_cluster" : "unmatched_single",
      appointmentIds: cluster.map((appointment) => appointment.id),
    });
    cluster = [];
  };

  for (const appointment of remaining) {
    const first = cluster[0];
    const previous = cluster[cluster.length - 1];
    if (
      first &&
      previous &&
      canJoinCluster(first, previous, appointment)
    ) {
      cluster.push(appointment);
      continue;
    }
    flush();
    cluster = [appointment];
  }
  flush();

  return groups;
}

function canJoinCluster(
  first: HistoricalAppointment,
  previous: HistoricalAppointment,
  next: HistoricalAppointment,
) {
  if (first.customerId !== next.customerId) return false;
  if (first.appointmentDate !== next.appointmentDate) return false;
  if (historicalAddressKey(first) !== historicalAddressKey(next)) return false;
  const elapsed = Date.parse(next.createdAt) - Date.parse(first.createdAt);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > HISTORICAL_CLUSTER_GAP_MS) {
    return false;
  }
  if (previous.scheduledStart == null || next.scheduledStart == null) return false;
  return next.scheduledStart > previous.scheduledStart;
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

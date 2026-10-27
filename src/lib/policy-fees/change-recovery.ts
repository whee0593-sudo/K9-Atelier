import type { PolicyClaimStatus, PolicyPaymentState } from "@/lib/policy-fees/execute";

export type ChangePhase = "pending" | "applying" | "applied" | "review";

export type RecoveryAppointment = {
  id: string;
  status: string;
  appointmentDate: string;
  scheduledStart: number | null;
  appointmentTime: string | null;
  timePreference: string | null;
  visitSequence: number | null;
};

export type ChangeRecoveryPayload = {
  operationId: string;
  action: "cancel" | "reschedule" | "remove_dog";
  visitId: string;
  confirmedFee: number;
  appointmentIds: string[];
  appointments: RecoveryAppointment[];
  rescheduleTo: { date: string; slotStartMinutes: number } | null;
};

export type LiveAppointment = {
  id: string;
  status: string;
  appointmentDate: string;
  scheduledStart: number | null;
};

export type RecoveryClaim = {
  id: string;
  status: PolicyClaimStatus;
  paymentState: PolicyPaymentState;
  phase: ChangePhase;
  calendarWritten: boolean;
  applied: boolean;
  action: string;
  chargedAmount: number;
  idempotencyKey: string;
  visitId: string;
  payload: unknown;
};

export type CalendarWriteResult =
  | "written"
  | "already_written"
  | "already"
  | "review"
  | "not_ready"
  | "not_acquired"
  | "plan_required"
  | "slot_unavailable"
  | "missing";

export type ChangeMarkResult = "applied" | "already_applied" | "not_written" | "not_ready";

export type ResumeResult =
  | { outcome: "applied"; wrote: boolean; payload: ChangeRecoveryPayload | null }
  | { outcome: "already"; payload: ChangeRecoveryPayload | null }
  | { outcome: "review" }
  | { outcome: "slot_unavailable" }
  | { outcome: "not_ready" }
  | { outcome: "payment_locked" };

const PHASES = new Set<ChangePhase>(["pending", "applying", "applied", "review"]);

export function changePhaseFrom(value: unknown): ChangePhase {
  return typeof value === "string" && PHASES.has(value as ChangePhase)
    ? (value as ChangePhase)
    : "pending";
}

function moneyEqual(left: number, right: number) {
  return Math.round(left * 100) === Math.round(right * 100);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function wholeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildChangeRecoveryPayload(input: {
  operationId: string;
  action: "cancel" | "reschedule" | "remove_dog";
  visitId: string;
  confirmedFee: number;
  rows: Array<{
    id: string;
    status?: string | null;
    appointment_date: string;
    scheduled_start?: number | null;
    appointment_time?: string | null;
    time_preference?: string | null;
    visit_sequence?: number | null;
  }>;
  rescheduleTo?: { date: string; slotStartMinutes: number } | null;
}): ChangeRecoveryPayload {
  const appointments = input.rows.map((row) => ({
    id: row.id,
    status: row.status ?? "",
    appointmentDate: row.appointment_date,
    scheduledStart: row.scheduled_start ?? null,
    appointmentTime: row.appointment_time ?? null,
    timePreference: row.time_preference ?? null,
    visitSequence: row.visit_sequence ?? null,
  }));
  return {
    operationId: input.operationId,
    action: input.action,
    visitId: input.visitId,
    confirmedFee: input.confirmedFee,
    appointmentIds: appointments.map((row) => row.id),
    appointments,
    rescheduleTo:
      input.action === "reschedule" && input.rescheduleTo ? input.rescheduleTo : null,
  };
}

export function parseChangeRecoveryPayload(
  value: unknown,
  expected: {
    operationId: string;
    action: string;
    visitId: string;
    confirmedFee: number;
  },
): ChangeRecoveryPayload | null {
  const body = asRecord(value);
  if (!body) return null;
  const action = body.action;
  if (action !== "cancel" && action !== "reschedule" && action !== "remove_dog") return null;
  if (action !== expected.action) return null;
  if (text(body.operationId) !== expected.operationId) return null;
  if (text(body.visitId) !== expected.visitId) return null;
  if (!moneyEqual(wholeNumber(body.confirmedFee) ?? Number.NaN, expected.confirmedFee)) {
    return null;
  }
  if (!Array.isArray(body.appointments) || body.appointments.length === 0) return null;
  const appointments: RecoveryAppointment[] = [];
  for (const entry of body.appointments) {
    const row = asRecord(entry);
    const id = row ? text(row.id) : null;
    const status = row ? text(row.status) : null;
    const appointmentDate = row ? text(row.appointmentDate) : null;
    if (!row || !id || !status || !appointmentDate) return null;
    const scheduled = row.scheduledStart;
    appointments.push({
      id,
      status,
      appointmentDate,
      scheduledStart: typeof scheduled === "number" ? scheduled : null,
      appointmentTime: text(row.appointmentTime),
      timePreference: text(row.timePreference),
      visitSequence: typeof row.visitSequence === "number" ? row.visitSequence : null,
    });
  }
  const ids = appointments.map((row) => row.id);
  if (new Set(ids).size !== ids.length) return null;
  const target = asRecord(body.rescheduleTo);
  const rescheduleTo =
    action === "reschedule" && target && text(target.date) && typeof target.slotStartMinutes === "number"
      ? { date: text(target.date)!, slotStartMinutes: target.slotStartMinutes as number }
      : null;
  if (action === "reschedule" && !rescheduleTo) return null;
  return {
    operationId: expected.operationId,
    action,
    visitId: expected.visitId,
    confirmedFee: expected.confirmedFee,
    appointmentIds: ids,
    appointments,
    rescheduleTo,
  };
}

export function classifyCalendarWrite(input: {
  phase: ChangePhase;
  calendarWritten: boolean;
  applied: boolean;
  payload: ChangeRecoveryPayload | null;
  live: LiveAppointment[];
}): "write" | "mark_only" | "review" | "already" | "not_ready" {
  if (input.applied || input.phase === "applied") return "already";
  if (input.phase === "review") return "review";
  if (input.calendarWritten) return "mark_only";
  if (input.phase !== "pending" && input.phase !== "applying") return "not_ready";
  if (!input.payload) return "review";
  const expected = new Map(input.payload.appointments.map((row) => [row.id, row]));
  if (expected.size === 0 || input.live.length !== expected.size) return "review";
  for (const row of input.live) {
    const saved = expected.get(row.id);
    if (!saved) return "review";
    if (saved.status !== row.status) return "review";
    if (saved.appointmentDate !== row.appointmentDate) return "review";
    if ((saved.scheduledStart ?? null) !== (row.scheduledStart ?? null)) return "review";
  }
  return "write";
}

const LOCKED_PAYMENT = new Set<PolicyPaymentState>([
  "unknown",
  "submitting",
  "awaiting_customer",
  "processing",
]);

function settled(status: PolicyClaimStatus) {
  return status === "charged" || status === "waived" || status === "no_fee";
}

export async function resumeAppointmentChange(deps: {
  load: () => Promise<RecoveryClaim | null>;
  acquire: () => Promise<
    "apply" | "resume" | "already" | "busy" | "review" | "not_ready" | "missing"
  >;
  release: () => Promise<void>;
  loadLive: (ids: string[]) => Promise<LiveAppointment[]>;
  plan?: (
    payload: ChangeRecoveryPayload,
  ) => Promise<{ ok: true; plan: unknown } | { error: "slot_unavailable" | "server" }>;
  apply: (plan: unknown | null) => Promise<CalendarWriteResult>;
  mark: () => Promise<ChangeMarkResult>;
  afterWrite?: (payload: ChangeRecoveryPayload) => Promise<void>;
}): Promise<ResumeResult> {
  const claim = await deps.load();
  if (!claim) return { outcome: "not_ready" };
  if (LOCKED_PAYMENT.has(claim.paymentState) || claim.status === "charging") {
    return { outcome: "payment_locked" };
  }
  if (!settled(claim.status)) return { outcome: "not_ready" };
  if (claim.applied || claim.phase === "applied") {
    return {
      outcome: "already",
      payload: parseChangeRecoveryPayload(claim.payload, {
        operationId: claim.idempotencyKey,
        action: claim.action,
        visitId: claim.visitId,
        confirmedFee: claim.chargedAmount,
      }),
    };
  }

  const gate = await deps.acquire();
  if (gate === "already") return { outcome: "already", payload: null };
  if (gate === "review") return { outcome: "review" };
  if (gate !== "apply" && gate !== "resume") return { outcome: "not_ready" };

  const current = (await deps.load()) ?? claim;
  const payload = parseChangeRecoveryPayload(current.payload, {
    operationId: current.idempotencyKey,
    action: current.action,
    visitId: current.visitId,
    confirmedFee: current.chargedAmount,
  });
  if (current.calendarWritten) {
    const marked = await deps.mark();
    if (marked === "applied" || marked === "already_applied") {
      return { outcome: "applied", wrote: false, payload };
    }
    return { outcome: "not_ready" };
  }

  const live = payload ? await deps.loadLive(payload.appointmentIds) : [];
  const decision = classifyCalendarWrite({
    phase: current.phase,
    calendarWritten: current.calendarWritten,
    applied: current.applied,
    payload,
    live,
  });
  if (decision === "review" || decision === "not_ready" || !payload) {
    const reviewed = await deps.apply(null);
    return reviewed === "review" || decision === "review"
      ? { outcome: "review" }
      : { outcome: "not_ready" };
  }

  let plan: unknown = null;
  if (payload.action === "reschedule") {
    if (!deps.plan) return { outcome: "not_ready" };
    const planned = await deps.plan(payload);
    if ("error" in planned) {
      if (planned.error === "slot_unavailable") {
        const latest = await deps.load();
        if (latest?.calendarWritten || latest?.applied) {
          const marked = await deps.mark();
          if (marked === "applied" || marked === "already_applied") {
            return { outcome: "applied", wrote: false, payload };
          }
        } else {
          await deps.release();
        }
        return { outcome: "slot_unavailable" };
      }
      return { outcome: "not_ready" };
    }
    plan = planned.plan;
  }

  const written = await deps.apply(plan);
  if (written === "slot_unavailable") {
    const latest = await deps.load();
    if (!latest?.calendarWritten && !latest?.applied) await deps.release();
    return { outcome: "slot_unavailable" };
  }
  if (written === "review") return { outcome: "review" };
  if (written === "already") return { outcome: "already", payload };
  if (written !== "written" && written !== "already_written") return { outcome: "not_ready" };
  if (written === "written" && deps.afterWrite) {
    try {
      await deps.afterWrite(payload);
    } catch (error) {
      console.error("appointment change follow-up failed:", error);
    }
  }
  const marked = await deps.mark();
  if (marked !== "applied" && marked !== "already_applied") return { outcome: "not_ready" };
  return { outcome: "applied", wrote: written === "written", payload };
}

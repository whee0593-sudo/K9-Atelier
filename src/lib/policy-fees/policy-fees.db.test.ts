import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { after, before, describe, it } from "node:test";

type PolicyDbClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
};

const require = createRequire(import.meta.url);
const { Client } = require("pg") as {
  Client: new (config: {
    host: string;
    port: number;
    user: string;
    database: string;
  }) => PolicyDbClient;
};

const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONTROLS = "supabase/migrations/20261018190000_policy_fee_controls.sql";
const FUNCTIONS = "supabase/migrations/20261018190100_policy_fee_functions.sql";

function pgBinary(name: string) {
  for (const version of ["18", "17", "16", "15", "14"]) {
    const candidate = `/usr/lib/postgresql/${version}/bin/${name}`;
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`PostgreSQL ${name} is required for the policy-fee test.`);
}

function sqlFile(relative: string) {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

function asJson(value: unknown) {
  const body =
    typeof value === "string"
      ? (JSON.parse(value) as Record<string, unknown>)
      : (value as Record<string, unknown> | null);
  if (!body || typeof body !== "object") {
    throw new Error(`unexpected jsonb: ${String(value)}`);
  }
  return body;
}

function fixtureSql() {
  return `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END $$;
    GRANT anon, authenticated, service_role TO CURRENT_USER;

    CREATE SCHEMA IF NOT EXISTS private;
    REVOKE ALL ON SCHEMA private FROM PUBLIC;
    GRANT USAGE ON SCHEMA private TO authenticated, service_role;
    CREATE OR REPLACE FUNCTION private.is_staff()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SET search_path = ''
    AS $fn$
      SELECT current_setting('k9.test_staff', true) = 'on';
    $fn$;
    GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated, service_role;

    CREATE TABLE public.visits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid
    );
    CREATE TABLE public.appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      visit_id uuid REFERENCES public.visits (id),
      customer_id uuid,
      status text
    );
    CREATE TABLE public.appointment_charges (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id uuid NOT NULL REFERENCES public.appointments (id),
      visit_id uuid,
      kind text NOT NULL,
      status text NOT NULL,
      line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
      subtotal numeric NOT NULL DEFAULT 0,
      tip_amount numeric NOT NULL DEFAULT 0,
      total numeric NOT NULL DEFAULT 0,
      stripe_payment_intent_id text,
      refunded_amount numeric NOT NULL DEFAULT 0,
      refunded_at timestamptz,
      tender text,
      created_by uuid,
      paid_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX appointment_charges_one_paid_kind_uidx
      ON public.appointment_charges (appointment_id, kind)
      WHERE status = 'paid';
  `;
}

describe("policy fee postgres controls", () => {
  const port = 55441;
  let dataDir = "";
  let socketDir = "";
  let server: ReturnType<typeof spawn> | null = null;
  let left: PolicyDbClient | null = null;
  let right: PolicyDbClient | null = null;

  before(async () => {
    dataDir = mkdtempSync(path.join(tmpdir(), "k9-policy-pg-"));
    socketDir = mkdtempSync(path.join(tmpdir(), "k9-policy-sock-"));
    const init = spawnSync(
      pgBinary("initdb"),
      ["-D", dataDir, "-U", "postgres", "--auth=trust", "--no-sync"],
      { encoding: "utf8" },
    );
    if (init.status !== 0) throw new Error(init.stderr || init.stdout || "initdb failed");
    server = spawn(
      pgBinary("postgres"),
      ["-D", dataDir, "-k", socketDir, "-p", String(port), "-c", "listen_addresses=", "-c", "fsync=off"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let log = "";
    server.stdout?.resume();
    server.stderr?.on("data", (chunk: Buffer) => {
      log += String(chunk);
    });
    const deadline = Date.now() + 15000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode != null) throw new Error(`postgres exited: ${log}`);
      try {
        const probe = new Client({ host: socketDir, port, user: "postgres", database: "postgres" });
        await probe.connect();
        await probe.end();
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    if (!ready) throw new Error(`postgres did not start: ${log}`);
    left = new Client({ host: socketDir, port, user: "postgres", database: "postgres" });
    right = new Client({ host: socketDir, port, user: "postgres", database: "postgres" });
    await left.connect();
    await right.connect();
    await left.query(fixtureSql());
    await left.query(sqlFile(CONTROLS));
    await left.query(sqlFile(FUNCTIONS));
  });

  after(async () => {
    await left?.end().catch(() => undefined);
    await right?.end().catch(() => undefined);
    if (dataDir && existsSync(pgBinary("pg_ctl"))) {
      spawnSync(pgBinary("pg_ctl"), ["-D", dataDir, "-m", "immediate", "stop"], {
        encoding: "utf8",
      });
    }
    if (server && server.exitCode == null) server.kill("SIGKILL");
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    if (socketDir) rmSync(socketDir, { recursive: true, force: true });
  });

  async function makeVisit(dogs: number) {
    const visit = await left!.query<{ id: string }>(
      "INSERT INTO public.visits (customer_id) VALUES ($1) RETURNING id",
      [CUSTOMER],
    );
    const visitId = visit.rows[0]!.id;
    const appointmentIds: string[] = [];
    for (let index = 0; index < dogs; index += 1) {
      const row = await left!.query<{ id: string }>(
        `INSERT INTO public.appointments (visit_id, customer_id, status)
         VALUES ($1, $2, 'confirmed') RETURNING id`,
        [visitId, CUSTOMER],
      );
      appointmentIds.push(row.rows[0]!.id);
    }
    return { visitId, appointmentIds };
  }

  function removeInput(
    made: { visitId: string; appointmentIds: string[] },
    index: number,
    amounts: { computed: number; charged: number; waiver: number; tender?: string | null },
  ) {
    return {
      idempotency_key: `remove_dog:appointment:${made.appointmentIds[index]}`,
      visit_id: made.visitId,
      action: "remove_dog",
      appointment_id: made.appointmentIds[index],
      affected_appointment_ids: [made.appointmentIds[index]],
      includes_travel: false,
      forfeit: true,
      computed: amounts.computed,
      charged: amounts.charged,
      waiver: amounts.waiver,
      tender: amounts.tender ?? null,
      actor_id: ACTOR,
      change_payload: { action: "remove_dog" },
    };
  }

  async function begin(client: PolicyDbClient, input: Record<string, unknown>) {
    const result = await client.query<{ result: unknown }>(
      "SELECT public.begin_policy_fee_claim($1::jsonb) AS result",
      [JSON.stringify(input)],
    );
    return asJson(result.rows[0]?.result);
  }

  async function call(name: string, payload: Record<string, unknown>) {
    const result = await left!.query<{ result: unknown }>(
      `SELECT public.${name}($1::jsonb) AS result`,
      [JSON.stringify(payload)],
    );
    return asJson(result.rows[0]?.result);
  }

  it("keeps a historical charge unchanged when the migration is applied again", async () => {
    const made = await makeVisit(1);
    const inserted = await left!.query<{ id: string }>(
      `INSERT INTO public.appointment_charges (
         appointment_id, visit_id, kind, status, subtotal, total, stripe_payment_intent_id, tender
       ) VALUES ($1, $2, 'cancellation', 'paid', 55, 55, 'pi_historical', 'card')
       RETURNING id`,
      [made.appointmentIds[0], made.visitId],
    );
    await left!.query(sqlFile(CONTROLS));
    await left!.query(sqlFile(FUNCTIONS));
    const row = await left!.query<{ total: string; stripe_payment_intent_id: string; claim_id: string | null }>(
      "SELECT total, stripe_payment_intent_id, claim_id FROM public.appointment_charges WHERE id = $1",
      [inserted.rows[0]!.id],
    );
    assert.equal(Number(row.rows[0]?.total), 55);
    assert.equal(row.rows[0]?.stripe_payment_intent_id, "pi_historical");
    assert.equal(row.rows[0]?.claim_id, null);
  });

  it("charges the computed fee when the fixed cap is higher", async () => {
    const priced = await left!.query<{ charged: string; waiver: string }>(
      "SELECT charged, waiver FROM public.policy_fee_amounts(10, 20)",
    );
    assert.equal(Number(priced.rows[0]?.charged), 10);
    assert.equal(Number(priced.rows[0]?.waiver), 0);

    const made = await makeVisit(1);
    const key = `remove_dog:appointment:${made.appointmentIds[0]}`;
    const waiver = await call("authorize_policy_fee_waiver", {
      idempotency_key: key,
      visit_id: made.visitId,
      action: "remove_dog",
      appointment_id: made.appointmentIds[0],
      collect_cap: 20,
      reason: "Owner approved a fixed cap",
      actor_id: ACTOR,
    });
    assert.equal(waiver.outcome, "authorized");
    const created = await begin(
      left!,
      removeInput(made, 0, { computed: 10, charged: 10, waiver: 0, tender: "card" }),
    );
    assert.equal(created.outcome, "created");
    assert.equal(Number(created.charged), 10);
    assert.equal(Number(created.waiver), 0);
    assert.equal(Number(created.collect_cap), 20);
    const adjustments = await left!.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.fee_adjustments WHERE claim_id = $1",
      [created.claim_id],
    );
    assert.equal(adjustments.rows[0]?.count, "0");
  });

  it("rejects a caller amount that ignores the lower cap and writes nothing", async () => {
    const made = await makeVisit(1);
    const key = `remove_dog:appointment:${made.appointmentIds[0]}`;
    await call("authorize_policy_fee_waiver", {
      idempotency_key: key,
      visit_id: made.visitId,
      action: "remove_dog",
      appointment_id: made.appointmentIds[0],
      collect_cap: 4,
      reason: "Partial courtesy cap",
      actor_id: ACTOR,
    });
    const mismatch = await begin(
      left!,
      removeInput(made, 0, { computed: 10, charged: 10, waiver: 0, tender: "card" }),
    );
    assert.equal(mismatch.outcome, "amount_mismatch");
    assert.equal(Number(mismatch.charged), 4);
    assert.equal(Number(mismatch.waiver), 6);
    const claims = await left!.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.policy_fee_claims WHERE visit_id = $1",
      [made.visitId],
    );
    assert.equal(claims.rows[0]?.count, "0");
    const saved = await begin(
      left!,
      removeInput(made, 0, { computed: 10, charged: 4, waiver: 6, tender: "card" }),
    );
    assert.equal(saved.outcome, "created");
    assert.equal(Number(saved.charged), 4);
    assert.equal(Number(saved.waiver), 6);
  });

  it("lets two removed dogs each take their own fee after the first change is applied", async () => {
    const made = await makeVisit(2);
    const first = await begin(left!, removeInput(made, 0, { computed: 0, charged: 0, waiver: 0 }));
    assert.equal(first.outcome, "created");
    const marked = await left!.query<{ result: unknown }>(
      "SELECT public.mark_policy_fee_change_applied($1::uuid) AS result",
      [first.claim_id],
    );
    assert.equal(asJson(marked.rows[0]?.result).outcome, "applied");
    const second = await begin(left!, removeInput(made, 1, { computed: 0, charged: 0, waiver: 0 }));
    assert.equal(second.outcome, "created");
    const coverage = await left!.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.policy_fee_coverage
       WHERE visit_id = $1 AND component = 'service' AND active`,
      [made.visitId],
    );
    assert.equal(coverage.rows[0]?.count, "2");
  });

  it("does not release the visit while a card charge is still charging", async () => {
    const made = await makeVisit(2);
    const first = await begin(
      left!,
      removeInput(made, 0, { computed: 10, charged: 10, waiver: 0, tender: "card" }),
    );
    const marked = await left!.query<{ result: unknown }>(
      "SELECT public.mark_policy_fee_change_applied($1::uuid) AS result",
      [first.claim_id],
    );
    assert.equal(asJson(marked.rows[0]?.result).outcome, "not_ready");
    const second = await begin(
      left!,
      removeInput(made, 1, { computed: 8, charged: 8, waiver: 0, tender: "card" }),
    );
    assert.equal(second.outcome, "visit_busy");
  });

  it("creates one claim and one coverage row when the same key is submitted twice", async () => {
    await left!.query(`
      CREATE OR REPLACE FUNCTION public.policy_fee_test_pause() RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        PERFORM pg_sleep(0.5);
        RETURN NEW;
      END
      $fn$;
      DROP TRIGGER IF EXISTS policy_fee_test_pause ON public.policy_fee_claims;
      CREATE TRIGGER policy_fee_test_pause
      BEFORE INSERT ON public.policy_fee_claims
      FOR EACH ROW EXECUTE FUNCTION public.policy_fee_test_pause();
    `);
    try {
      const made = await makeVisit(1);
      const input = removeInput(made, 0, { computed: 0, charged: 0, waiver: 0 });
      const [first, second] = await Promise.all([begin(left!, input), begin(right!, input)]);
      assert.deepEqual([first.outcome, second.outcome].sort(), ["created", "existing"]);
      assert.equal(first.claim_id, second.claim_id);
      const counts = await left!.query<{ claims: string; coverage: string }>(
        `SELECT
           (SELECT count(*)::text FROM public.policy_fee_claims WHERE visit_id = $1) AS claims,
           (SELECT count(*)::text FROM public.policy_fee_coverage WHERE visit_id = $1) AS coverage`,
        [made.visitId],
      );
      assert.equal(counts.rows[0]?.claims, "1");
      assert.equal(counts.rows[0]?.coverage, "1");
    } finally {
      await left!.query("DROP TRIGGER IF EXISTS policy_fee_test_pause ON public.policy_fee_claims");
    }
  });

  it("keeps a second in-flight dog busy while the first claim is still open", async () => {
    await left!.query(`
      DROP TRIGGER IF EXISTS policy_fee_test_pause ON public.policy_fee_claims;
      CREATE TRIGGER policy_fee_test_pause
      BEFORE INSERT ON public.policy_fee_claims
      FOR EACH ROW EXECUTE FUNCTION public.policy_fee_test_pause();
    `);
    try {
      const made = await makeVisit(2);
      const [first, second] = await Promise.all([
        begin(left!, removeInput(made, 0, { computed: 12, charged: 12, waiver: 0, tender: "card" })),
        begin(right!, removeInput(made, 1, { computed: 9, charged: 9, waiver: 0, tender: "card" })),
      ]);
      assert.deepEqual([first.outcome, second.outcome].sort(), ["created", "visit_busy"]);
      const claims = await left!.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.policy_fee_claims WHERE visit_id = $1",
        [made.visitId],
      );
      assert.equal(claims.rows[0]?.count, "1");
    } finally {
      await left!.query("DROP TRIGGER IF EXISTS policy_fee_test_pause ON public.policy_fee_claims");
    }
  });

  it("refuses a second PaymentIntent id and restarts only after a failed attempt", async () => {
    const made = await makeVisit(1);
    const input = removeInput(made, 0, { computed: 15, charged: 15, waiver: 0, tender: "card" });
    const created = await begin(left!, input);
    assert.equal(created.outcome, "created");
    const firstKey = String(created.stripe_idempotency_key);
    const saved = await left!.query<{ result: unknown }>(
      "SELECT public.record_policy_fee_intent($1::uuid, $2) AS result",
      [created.claim_id, "pi_once"],
    );
    assert.equal(asJson(saved.rows[0]?.result).outcome, "saved");
    const again = await left!.query<{ result: unknown }>(
      "SELECT public.record_policy_fee_intent($1::uuid, $2) AS result",
      [created.claim_id, "pi_once"],
    );
    assert.equal(asJson(again.rows[0]?.result).outcome, "saved");
    const different = await left!.query<{ result: unknown }>(
      "SELECT public.record_policy_fee_intent($1::uuid, $2) AS result",
      [created.claim_id, "pi_other"],
    );
    assert.equal(asJson(different.rows[0]?.result).outcome, "different_intent");
    const failed = await left!.query<{ result: unknown }>(
      "SELECT public.fail_policy_fee_claim($1::uuid, 'card_declined') AS result",
      [created.claim_id],
    );
    assert.equal(asJson(failed.rows[0]?.result).outcome, "failed");
    const coverage = await left!.query<{ active: boolean; release_reason: string }>(
      "SELECT active, release_reason FROM public.policy_fee_coverage WHERE claim_id = $1",
      [created.claim_id],
    );
    assert.equal(coverage.rows[0]?.active, false);
    assert.equal(coverage.rows[0]?.release_reason, "charge_failed");
    const restarted = await begin(left!, input);
    assert.equal(restarted.outcome, "created");
    assert.equal(restarted.claim_id, created.claim_id);
    assert.equal(Number(restarted.attempt), 2);
    assert.notEqual(restarted.stripe_idempotency_key, firstKey);
    assert.equal(restarted.stripe_payment_intent_id, null);
    const active = await left!.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.policy_fee_coverage
       WHERE visit_id = $1 AND active`,
      [made.visitId],
    );
    assert.equal(active.rows[0]?.count, "1");
  });

  it("confirms no-show evidence only after the wait, and never on insert", async () => {
    const made = await makeVisit(1);
    const draft = await left!.query<{ id: string }>(
      `INSERT INTO public.visit_no_show_reports (
         visit_id, arrived_at, contact_attempted_at, contact_channel,
         customer_replied, handoff_arranged, recorded_by, status
       ) VALUES (
         $1, now() - interval '20 minutes', now() - interval '14 minutes',
         'phone', false, false, $2, 'draft'
       ) RETURNING id`,
      [made.visitId, ACTOR],
    );
    await assert.rejects(
      () =>
        left!.query(
          `UPDATE public.visit_no_show_reports
           SET status = 'confirmed', confirmed_by = $2, confirmed_at = now()
           WHERE id = $1`,
          [draft.rows[0]!.id, ACTOR],
        ),
      /not ready to confirm/,
    );
    await assert.rejects(
      () =>
        left!.query(
          `INSERT INTO public.visit_no_show_reports (
             visit_id, arrived_at, contact_attempted_at, contact_channel,
             customer_replied, handoff_arranged, recorded_by, status, confirmed_by, confirmed_at
           ) VALUES (
             $1, now() - interval '30 minutes', now() - interval '20 minutes',
             'phone', false, false, $2, 'confirmed', $2, now()
           )`,
          [made.visitId, ACTOR],
        ),
      /draft before it is confirmed/,
    );
    await left!.query(
      `UPDATE public.visit_no_show_reports
       SET contact_attempted_at = now() - interval '15 minutes',
           status = 'confirmed', confirmed_by = $2, confirmed_at = now()
       WHERE id = $1`,
      [draft.rows[0]!.id, ACTOR],
    );
    const status = await left!.query<{ status: string }>(
      "SELECT status FROM public.visit_no_show_reports WHERE id = $1",
      [draft.rows[0]!.id],
    );
    assert.equal(status.rows[0]?.status, "confirmed");
  });

  it("keeps forfeiture coverage after a normal refund and blocks another no-show", async () => {
    const made = await makeVisit(1);
    await left!.query(
      `INSERT INTO public.visit_no_show_reports (
         visit_id, arrived_at, contact_attempted_at, contact_channel,
         customer_replied, handoff_arranged, recorded_by, status, confirmed_by, confirmed_at
       ) VALUES (
         $1, now() - interval '40 minutes', now() - interval '20 minutes',
         'text_message', false, false, $2, 'draft', NULL, NULL
       )`,
      [made.visitId, ACTOR],
    );
    await left!.query(
      `UPDATE public.visit_no_show_reports
       SET status = 'confirmed', confirmed_by = $2, confirmed_at = now()
       WHERE visit_id = $1`,
      [made.visitId, ACTOR],
    );
    const created = await begin(left!, {
      idempotency_key: `no_show:visit:${made.visitId}`,
      visit_id: made.visitId,
      action: "no_show",
      appointment_id: made.appointmentIds[0],
      affected_appointment_ids: made.appointmentIds,
      includes_travel: false,
      forfeit: true,
      computed: 40,
      charged: 40,
      waiver: 0,
      tender: "card",
      actor_id: ACTOR,
      change_payload: { action: "no_show" },
    });
    assert.equal(created.outcome, "created");
    const charge = await left!.query<{ id: string }>(
      `INSERT INTO public.appointment_charges (
         appointment_id, visit_id, claim_id, kind, status, subtotal, total,
         stripe_payment_intent_id, tender, paid_at
       ) VALUES ($1, $2, $3, 'no_show', 'paid', 40, 40, 'pi_noshow', 'card', now())
       RETURNING id`,
      [made.appointmentIds[0], made.visitId, created.claim_id],
    );
    await left!.query("SELECT public.complete_policy_fee_claim($1::uuid, $2::uuid)", [
      created.claim_id,
      charge.rows[0]!.id,
    ]);
    const started = await call("begin_policy_fee_refund", {
      charge_id: charge.rows[0]!.id,
      amount: 40,
      expected_refunded: 0,
      actor_id: ACTOR,
      reason: "Customer asked for a refund",
    });
    assert.equal(started.outcome, "pending");
    const completed = await left!.query<{ result: unknown }>(
      "SELECT public.complete_policy_fee_refund($1::uuid, $2, NULL) AS result",
      [started.adjustment_id, "re_test"],
    );
    assert.equal(asJson(completed.rows[0]?.result).outcome, "completed");
    const stored = await left!.query<{
      total: string;
      refunded_amount: string;
      stripe_payment_intent_id: string;
      active: boolean;
    }>(
      `SELECT c.total, c.refunded_amount, c.stripe_payment_intent_id, cov.active
       FROM public.appointment_charges c
       JOIN public.policy_fee_coverage cov ON cov.claim_id = c.claim_id
       WHERE c.id = $1`,
      [charge.rows[0]!.id],
    );
    assert.equal(Number(stored.rows[0]?.total), 40);
    assert.equal(Number(stored.rows[0]?.refunded_amount), 40);
    assert.equal(stored.rows[0]?.stripe_payment_intent_id, "pi_noshow");
    assert.equal(stored.rows[0]?.active, true);
    const repeat = await begin(left!, {
      idempotency_key: `remove_dog:appointment:${made.appointmentIds[0]}`,
      visit_id: made.visitId,
      action: "remove_dog",
      appointment_id: made.appointmentIds[0],
      affected_appointment_ids: [made.appointmentIds[0]],
      includes_travel: false,
      forfeit: true,
      computed: 40,
      charged: 40,
      waiver: 0,
      tender: "card",
      actor_id: ACTOR,
      change_payload: {},
    });
    assert.equal(repeat.outcome, "coverage_conflict");
  });

  it("requires an admin reopen before a refunded service can be charged again", async () => {
    const made = await makeVisit(1);
    const first = await begin(left!, removeInput(made, 0, { computed: 0, charged: 0, waiver: 0 }));
    await left!.query("SELECT public.mark_policy_fee_change_applied($1::uuid)", [first.claim_id]);
    const coverage = await left!.query<{ id: string }>(
      "SELECT id FROM public.policy_fee_coverage WHERE claim_id = $1",
      [first.claim_id],
    );
    const reopened = await call("reopen_policy_fee_coverage", {
      visit_id: made.visitId,
      action: "remove_dog",
      base_key: `remove_dog:appointment:${made.appointmentIds[0]}`,
      coverage_ids: [coverage.rows[0]!.id],
      reason: "Charge was taken in error",
      actor_id: ACTOR,
    });
    assert.equal(reopened.outcome, "authorized");
    const next = await begin(left!, {
      ...removeInput(made, 0, { computed: 0, charged: 0, waiver: 0 }),
      idempotency_key: reopened.idempotency_key,
    });
    assert.equal(next.outcome, "created");
    const states = await left!.query<{ active: boolean; release_reason: string | null }>(
      `SELECT active, release_reason FROM public.policy_fee_coverage
       WHERE visit_id = $1 ORDER BY created_at`,
      [made.visitId],
    );
    assert.equal(states.rows[0]?.active, false);
    assert.equal(states.rows[0]?.release_reason, "admin_reopen");
    assert.equal(states.rows[1]?.active, true);
  });

  it("keeps legacy null claim rows unique and allows claim-backed repeats", async () => {
    const made = await makeVisit(1);
    const claims = [];
    for (const suffix of ["a", "b"]) {
      const row = await left!.query<{ id: string }>(
        `INSERT INTO public.policy_fee_claims (
           idempotency_key, visit_id, action, appointment_id, forfeit,
           computed_amount, waiver_amount, charged_amount, status,
           stripe_idempotency_key, actor_id, appointment_change_applied
         ) VALUES (
           $1, $2, 'reschedule', $3, false, 0, 0, 0, 'no_fee', $4, $5, true
         ) RETURNING id`,
        [
          `reschedule-index-${suffix}-${made.visitId}`,
          made.visitId,
          made.appointmentIds[0],
          `reschedule-index-${suffix}-${made.visitId}:1`,
          ACTOR,
        ],
      );
      claims.push(row.rows[0]!.id);
    }
    for (const claimId of claims) {
      await left!.query(
        `INSERT INTO public.appointment_charges (
           appointment_id, visit_id, claim_id, kind, status, subtotal, total
         ) VALUES ($1, $2, $3, 'cancellation', 'paid', 10, 10)`,
        [made.appointmentIds[0], made.visitId, claimId],
      );
    }
    await left!.query(
      `INSERT INTO public.appointment_charges (
         appointment_id, visit_id, kind, status, subtotal, total
       ) VALUES ($1, $2, 'cancellation', 'paid', 22, 22)`,
      [made.appointmentIds[0], made.visitId],
    );
    await assert.rejects(
      () =>
        left!.query(
          `INSERT INTO public.appointment_charges (
             appointment_id, visit_id, kind, status, subtotal, total
           ) VALUES ($1, $2, 'cancellation', 'paid', 22, 22)`,
          [made.appointmentIds[0], made.visitId],
        ),
      /appointment_charges_one_paid_kind_uidx/,
    );
  });

  it("reviews a legacy fee without changing its total or Stripe id", async () => {
    const made = await makeVisit(1);
    const charge = await left!.query<{ id: string }>(
      `INSERT INTO public.appointment_charges (
         appointment_id, visit_id, kind, status, subtotal, total, stripe_payment_intent_id
       ) VALUES ($1, $2, 'cancellation', 'paid', 33, 33, 'pi_legacy')
       RETURNING id`,
      [made.appointmentIds[0], made.visitId],
    );
    const reviewed = await call("review_legacy_policy_charge", {
      charge_id: charge.rows[0]!.id,
      visit_id: made.visitId,
      classification: "forfeit",
      covers_travel: false,
      appointment_ids: made.appointmentIds,
      reason: "Older cancellation covered this dog",
      actor_id: ACTOR,
    });
    assert.equal(reviewed.outcome, "reviewed");
    const row = await left!.query<{ total: string; stripe_payment_intent_id: string }>(
      "SELECT total, stripe_payment_intent_id FROM public.appointment_charges WHERE id = $1",
      [charge.rows[0]!.id],
    );
    assert.equal(Number(row.rows[0]?.total), 33);
    assert.equal(row.rows[0]?.stripe_payment_intent_id, "pi_legacy");
  });

  it("hides policy tables from customers and denies their writes", async () => {
    const privileges = await left!.query<{
      staff_select: boolean;
      staff_insert: boolean;
      anon_select: boolean;
      service_insert: boolean;
    }>(`
      SELECT
        has_table_privilege('authenticated', 'public.policy_fee_claims', 'SELECT') AS staff_select,
        has_table_privilege('authenticated', 'public.policy_fee_claims', 'INSERT') AS staff_insert,
        has_table_privilege('anon', 'public.policy_fee_claims', 'SELECT') AS anon_select,
        has_table_privilege('service_role', 'public.policy_fee_claims', 'INSERT') AS service_insert
    `);
    assert.equal(privileges.rows[0]?.staff_select, true);
    assert.equal(privileges.rows[0]?.staff_insert, false);
    assert.equal(privileges.rows[0]?.anon_select, false);
    assert.equal(privileges.rows[0]?.service_insert, true);

    await left!.query("SET ROLE authenticated");
    try {
      await left!.query("SELECT set_config('k9.test_staff', 'off', false)");
      const hidden = await left!.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.policy_fee_claims",
      );
      assert.equal(hidden.rows[0]?.count, "0");
      await assert.rejects(
        () =>
          left!.query(
            `INSERT INTO public.policy_fee_claims (
               idempotency_key, visit_id, action, forfeit, computed_amount,
               waiver_amount, charged_amount, status, stripe_idempotency_key, actor_id
             ) VALUES ('nope', gen_random_uuid(), 'cancel', true, 0, 0, 0, 'no_fee', 'nope:1', $1)`,
            [ACTOR],
          ),
        /permission denied/,
      );
      await left!.query("SELECT set_config('k9.test_staff', 'on', false)");
      const visible = await left!.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.policy_fee_claims",
      );
      assert.ok(Number(visible.rows[0]?.count) > 0);
    } finally {
      await left!.query("RESET ROLE");
    }
  });
});

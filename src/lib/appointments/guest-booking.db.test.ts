import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { Client } from "pg";

declare module "pg" {
  export class Client {
    constructor(config: {
      host: string;
      port: number;
      user: string;
      database: string;
    });
    connect(): Promise<void>;
    end(): Promise<void>;
    query<T extends Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<{ rows: T[] }>;
  }
}

const CUSTOMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PET = "11111111-1111-4111-8111-111111111111";
const CARD = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";
const OTHER_KEY = "44444444-4444-4444-8444-444444444444";

let db: PGlite;

function payload(hash: string, start = 600) {
  const visit = {
    customer_id: CUSTOMER,
    service_date: "2026-10-20",
    scheduled_start: start,
    appointment_time: "10:00 AM",
    time_preference: "morning",
    timezone: "America/New_York",
    status: "confirmed",
    address_street: "100 Olive Ave",
    address_city: "West Palm Beach",
    address_state: "FL",
    address_zip: "33401",
    address_lat: 26.72,
    address_lon: -80.05,
    travel_distance_miles: 12,
    travel_fee: 13,
  };
  const appointment = {
    customer_id: CUSTOMER,
    pet_id: PET,
    service_id: "signature-bath-care",
    service_name: "The Signature Bath",
    add_on_ids: [],
    add_on_options: {},
    address_street: visit.address_street,
    address_city: visit.address_city,
    address_state: visit.address_state,
    address_zip: visit.address_zip,
    travel_distance_miles: 12,
    travel_fee: 13,
    service_price: 90,
    estimated_duration_minutes: 60,
    visit_sequence: 1,
    appointment_date: "2026-10-20",
    appointment_time: "10:00 AM",
    scheduled_start: start,
    time_preference: "morning",
    address_lat: 26.72,
    address_lon: -80.05,
    timezone: "America/New_York",
    estimated_total: 103,
    new_client_deposit: 0,
    payment_method_id: CARD,
    vaccination_status_at_booking: "missing",
    status: "confirmed",
    confirmed_at: "2026-10-15T12:00:00Z",
  };
  return { hash, visit, appointment };
}

function bookingResult(value: unknown) {
  const body =
    typeof value === "string"
      ? (JSON.parse(value) as { created?: boolean; appointment_id?: string })
      : (value as { created?: boolean; appointment_id?: string } | null);
  if (
    !body ||
    typeof body.created !== "boolean" ||
    typeof body.appointment_id !== "string"
  ) {
    throw new Error(`unexpected booking result: ${JSON.stringify(value)}`);
  }
  return { created: body.created, appointmentId: body.appointment_id };
}

async function book(
  hash: string,
  key = KEY,
  start = 600,
  miles = 12,
  fee = 13,
) {
  const row = payload(hash, start);
  row.visit.travel_distance_miles = miles;
  row.visit.travel_fee = fee;
  row.appointment.travel_distance_miles = miles;
  row.appointment.travel_fee = fee;
  return db.query<{ result: unknown }>(
    `SELECT public.create_guest_booking($1::uuid, $2::text, $3::jsonb, $4::jsonb) AS result`,
    [key, row.hash, JSON.stringify(row.visit), JSON.stringify(row.appointment)],
  );
}

function fixtureSql() {
  return `
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;

    CREATE TYPE public.visit_status AS ENUM (
      'pending_confirmation', 'confirmed', 'completed', 'cancelled'
    );
    CREATE TYPE public.appointment_status AS ENUM (
      'pending_confirmation', 'confirmed', 'completed', 'cancelled'
    );

    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY
    );
    CREATE TABLE public.pets (
      id uuid PRIMARY KEY,
      customer_id uuid NOT NULL,
      archived_at timestamptz
    );
    CREATE TABLE public.payment_methods (
      id uuid PRIMARY KEY,
      customer_id uuid NOT NULL
    );
    CREATE TABLE public.visits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL,
      service_date date NOT NULL,
      scheduled_start integer,
      appointment_time text,
      time_preference text,
      timezone text NOT NULL DEFAULT 'America/New_York',
      status public.visit_status NOT NULL DEFAULT 'confirmed',
      address_street text NOT NULL,
      address_city text NOT NULL,
      address_state text NOT NULL,
      address_zip text NOT NULL,
      address_lat double precision,
      address_lon double precision,
      travel_distance_miles numeric(5, 1) NOT NULL DEFAULT 0,
      travel_fee numeric(8, 2) NOT NULL DEFAULT 0
    );
    CREATE TABLE public.appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL,
      visit_id uuid,
      visit_sequence integer,
      pet_id uuid NOT NULL,
      service_id text NOT NULL,
      service_name text NOT NULL,
      add_on_ids text[] NOT NULL DEFAULT '{}',
      add_on_options jsonb NOT NULL DEFAULT '{}'::jsonb,
      address_street text NOT NULL,
      address_city text NOT NULL,
      address_state text NOT NULL,
      address_zip text NOT NULL,
      travel_distance_miles numeric(5, 1) NOT NULL DEFAULT 0,
      travel_fee numeric(8, 2) NOT NULL DEFAULT 0,
      service_price numeric,
      estimated_duration_minutes integer,
      appointment_date date NOT NULL,
      appointment_time text,
      scheduled_start integer,
      time_preference text,
      address_lat double precision,
      address_lon double precision,
      timezone text NOT NULL DEFAULT 'America/New_York',
      estimated_total numeric,
      new_client_deposit numeric NOT NULL DEFAULT 0,
      payment_method_id uuid,
      vaccination_status_at_booking text,
      status public.appointment_status NOT NULL DEFAULT 'confirmed',
      confirmed_at timestamptz,
      staff_created boolean NOT NULL DEFAULT false
    );
    CREATE UNIQUE INDEX appointments_unique_scheduled_start
      ON public.appointments (appointment_date, scheduled_start)
      WHERE status IS DISTINCT FROM 'cancelled'
        AND scheduled_start IS NOT NULL;

    INSERT INTO public.profiles (id) VALUES ('${CUSTOMER}');
    INSERT INTO public.pets (id, customer_id) VALUES ('${PET}', '${CUSTOMER}');
    INSERT INTO public.payment_methods (id, customer_id) VALUES ('${CARD}', '${CUSTOMER}');
    SELECT set_config('app.user_id', '${CUSTOMER}', false);
  `;
}

before(async () => {
  db = new PGlite();
  await db.exec(fixtureSql());

  const migration = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20261015190000_guest_booking_idempotency.sql",
    ),
    "utf8",
  );
  await db.exec(migration);
});

describe("guest booking idempotency", () => {
  it("creates one visit and one appointment, then replays the same key", async () => {
    const first = await book("hash-a");
    const created = bookingResult(first.rows[0]?.result);
    assert.equal(created.created, true);

    const second = await book("hash-a");
    const replay = bookingResult(second.rows[0]?.result);
    assert.equal(replay.created, false);
    assert.equal(replay.appointmentId, created.appointmentId);

    const visits = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.visits",
    );
    const appointments = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.appointments",
    );
    assert.equal(visits.rows[0]?.count, "1");
    assert.equal(appointments.rows[0]?.count, "1");
  });

  it("rejects the same key when the booking contents differ", async () => {
    await assert.rejects(
      () => book("hash-b"),
      (error: unknown) =>
        error instanceof Error && error.message.includes("idempotency_mismatch"),
    );
    const visits = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.visits",
    );
    assert.equal(visits.rows[0]?.count, "1");
  });

  it("rolls back the visit when the appointment insert hits the slot constraint", async () => {
    await assert.rejects(() => book("hash-c", OTHER_KEY, 600));
    const visits = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.visits",
    );
    const claims = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.guest_booking_requests WHERE idempotency_key = $1",
      [OTHER_KEY],
    );
    assert.equal(visits.rows[0]?.count, "1");
    assert.equal(claims.rows[0]?.count, "0");
  });

  it("keeps the claim and both inserts inside one locked function", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20261015190000_guest_booking_idempotency.sql",
      ),
      "utf8",
    );
    const rollback = readFileSync(
      path.join(
        process.cwd(),
        "supabase/manual/rollback-guest-booking-idempotency.sql",
      ),
      "utf8",
    );
    const visitAt = sql.indexOf("INSERT INTO public.visits");
    const appointmentAt = sql.indexOf("INSERT INTO public.appointments");
    assert.match(sql, /ON CONFLICT \(customer_id, idempotency_key\) DO NOTHING/);
    assert.match(sql, /FOR UPDATE/);
    assert.match(sql, /idempotency_mismatch/);
    assert.match(
      sql,
      /GRANT EXECUTE ON FUNCTION public\.create_guest_booking\(uuid, text, jsonb, jsonb\) TO service_role/,
    );
    assert.match(
      sql,
      /REVOKE ALL ON FUNCTION public\.create_guest_booking\(uuid, text, jsonb, jsonb\) FROM authenticated/,
    );
    assert.equal(sql.includes("TO authenticated"), false);
    assert.match(sql, /REVOKE INSERT ON TABLE public\.visits FROM authenticated/);
    assert.match(
      sql,
      /REVOKE INSERT ON TABLE public\.appointments FROM authenticated/,
    );
    assert.equal(sql.includes("UPDATE public.appointments"), false);
    assert.equal(sql.includes("ALTER TABLE public.visits"), false);
    assert.ok(visitAt > 0 && visitAt < appointmentAt);
    assert.equal(sql.includes("create_staff_visit"), false);
    assert.equal(sql.includes("ALTER TABLE public.appointments"), false);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public.create_guest_booking/);
    assert.match(rollback, /DROP TABLE IF EXISTS public.guest_booking_requests/);
    assert.match(rollback, /CREATE POLICY visits_insert_own/);
    assert.match(rollback, /CREATE POLICY appointments_insert_own/);
    assert.equal(rollback.includes("DROP TABLE public.appointments"), false);
    assert.equal(rollback.includes("DROP TABLE public.visits"), false);
  });

  it("stores the fee from the raw miles when the mile column rounds to a tenth", async () => {
    const saved = await book(
      "hash-miles",
      "55555555-5555-4555-8555-555555555555",
      720,
      10.06,
      0,
    );
    assert.equal(bookingResult(saved.rows[0]?.result).created, true);
    const stored = await db.query<{ miles_rounded: boolean; fee_kept: boolean }>(
      `SELECT travel_distance_miles = 10.1 AS miles_rounded,
              travel_fee = 0 AS fee_kept
       FROM public.visits
       WHERE scheduled_start = 720`,
    );
    assert.equal(stored.rows[0]?.miles_rounded, true);
    assert.equal(stored.rows[0]?.fee_kept, true);
  });

  it("does not let a signed-in customer insert a visit directly", async () => {
    await db.exec(`GRANT authenticated TO CURRENT_USER`);
    await db.exec(`SET ROLE authenticated`);
    try {
      await assert.rejects(() =>
        db.exec(`
          INSERT INTO public.visits (
            customer_id, service_date, address_street, address_city,
            address_state, address_zip
          ) VALUES (
            '${CUSTOMER}', '2026-10-21', '1 Main', 'Lake Park', 'FL', '33403'
          )
        `),
      );
    } finally {
      await db.exec(`RESET ROLE`);
    }
  });
});

function pgBinary(name: string) {
  for (const version of ["18", "17", "16", "15", "14"]) {
    const candidate = `/usr/lib/postgresql/${version}/bin/${name}`;
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `PostgreSQL ${name} is required for the concurrency test.`,
  );
}

describe("two concurrent guest bookings", () => {
  const port = 55432;
  let dataDir = "";
  let socketDir = "";
  let server: ReturnType<typeof spawn> | null = null;
  let left: Client | null = null;
  let right: Client | null = null;

  before(async () => {
    dataDir = mkdtempSync(path.join(tmpdir(), "k9-guest-pg-"));
    socketDir = mkdtempSync(path.join(tmpdir(), "k9-guest-sock-"));
    const init = spawnSync(
      pgBinary("initdb"),
      ["-D", dataDir, "-U", "postgres", "--auth=trust", "--no-sync"],
      { encoding: "utf8" },
    );
    if (init.status !== 0) {
      throw new Error(init.stderr || init.stdout || "initdb failed");
    }
    server = spawn(
      pgBinary("postgres"),
      [
        "-D",
        dataDir,
        "-k",
        socketDir,
        "-p",
        String(port),
        "-c",
        "listen_addresses=",
        "-c",
        "fsync=off",
      ],
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
        const probe = new Client({
          host: socketDir,
          port,
          user: "postgres",
          database: "postgres",
        });
        await probe.connect();
        await probe.end();
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    if (!ready) throw new Error(`postgres did not start: ${log}`);

    left = new Client({
      host: socketDir,
      port,
      user: "postgres",
      database: "postgres",
    });
    right = new Client({
      host: socketDir,
      port,
      user: "postgres",
      database: "postgres",
    });
    await left.connect();
    await right.connect();
    await left.query(fixtureSql());
    await left.query(
      readFileSync(
        path.join(
          process.cwd(),
          "supabase/migrations/20261015190000_guest_booking_idempotency.sql",
        ),
        "utf8",
      ),
    );
    await left.query(`
      CREATE FUNCTION public.guest_booking_test_pause() RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        PERFORM pg_sleep(0.8);
        RETURN NEW;
      END
      $fn$;
      CREATE TRIGGER guest_booking_test_pause
      BEFORE INSERT ON public.guest_booking_requests
      FOR EACH ROW EXECUTE FUNCTION public.guest_booking_test_pause();
    `);
  });

  after(async () => {
    await left?.end().catch(() => undefined);
    await right?.end().catch(() => undefined);
    if (dataDir && existsSync(pgBinary("pg_ctl"))) {
      spawnSync(
        pgBinary("pg_ctl"),
        ["-D", dataDir, "-m", "immediate", "stop"],
        { encoding: "utf8" },
      );
    }
    if (server && server.exitCode == null) server.kill("SIGKILL");
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    if (socketDir) rmSync(socketDir, { recursive: true, force: true });
  });

  async function call(client: Client, hash: string, key: string, start: number) {
    const row = payload(hash, start);
    return client.query<{ result: unknown }>(
      `SELECT public.create_guest_booking($1::uuid, $2::text, $3::jsonb, $4::jsonb) AS result`,
      [key, row.hash, JSON.stringify(row.visit), JSON.stringify(row.appointment)],
    );
  }

  it("lets two overlapping sessions with the same key create one visit", async () => {
    const key = "66666666-6666-4666-8666-666666666666";
    const [firstCall, secondCall] = await Promise.all([
      call(left!, "hash-race", key, 800),
      call(right!, "hash-race", key, 800),
    ]);
    const results = [
      bookingResult(firstCall.rows[0]?.result),
      bookingResult(secondCall.rows[0]?.result),
    ];
    const created = results.filter((item) => item.created);
    const replayed = results.filter((item) => !item.created);
    assert.equal(created.length, 1);
    assert.equal(replayed.length, 1);
    assert.equal(replayed[0]?.appointmentId, created[0]?.appointmentId);
    const counts = await left!.query<{ visits: string; appointments: string }>(
      `SELECT
         (SELECT count(*)::text FROM public.visits) AS visits,
         (SELECT count(*)::text FROM public.appointments) AS appointments`,
    );
    assert.equal(counts.rows[0]?.visits, "1");
    assert.equal(counts.rows[0]?.appointments, "1");
  });

  it("rejects a concurrent call that reuses the key with different contents", async () => {
    const key = "77777777-7777-4777-8777-777777777777";
    const results = await Promise.allSettled([
      call(left!, "hash-left", key, 900),
      call(right!, "hash-right", key, 900),
    ]);
    assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
    const rejected = results.find((item) => item.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    const message =
      rejected.reason instanceof Error
        ? rejected.reason.message
        : String(rejected.reason);
    assert.match(message, /idempotency_mismatch/);
    const visits = await left!.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.visits",
    );
    assert.equal(visits.rows[0]?.count, "2");
  });

  it("rolls back the losing visit when two sessions claim the same time", async () => {
    const results = await Promise.allSettled([
      call(left!, "hash-slot-a", "88888888-8888-4888-8888-888888888888", 1000),
      call(right!, "hash-slot-b", "99999999-9999-4999-8999-999999999999", 1000),
    ]);
    assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(results.filter((item) => item.status === "rejected").length, 1);
    const visits = await left!.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.visits",
    );
    const claims = await left!.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.guest_booking_requests",
    );
    assert.equal(visits.rows[0]?.count, "3");
    assert.equal(claims.rows[0]?.count, "3");
  });
});

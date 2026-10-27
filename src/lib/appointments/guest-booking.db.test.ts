import { guestBookingFixtureSql as fixtureSql } from "@/lib/appointments/test-fixtures/guest-booking";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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


const EXPAND = "supabase/migrations/20261015190000_guest_booking_idempotency.sql";
const CONTRACT = "supabase/manual/guest-booking-contract.sql";
const ROLLBACK_EXPAND = "supabase/manual/rollback-guest-booking-expand.sql";
const APP_ROLLBACK = "supabase/manual/guest-booking-app-rollback.sql";
const FORWARD_FIX = "supabase/manual/guest-booking-contract-forward-fix.sql";

function sqlFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

before(async () => {
  db = new PGlite();
  await db.exec(fixtureSql());

  await db.exec(sqlFile(EXPAND));
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

  it("keeps expand and contract in separate execution paths", () => {
    const sql = sqlFile(EXPAND);
    const contract = sqlFile(CONTRACT);
    const rollback = sqlFile(ROLLBACK_EXPAND);
    const appRollback = sqlFile(APP_ROLLBACK);
    const forwardFix = sqlFile(FORWARD_FIX);
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
    assert.equal(sql.includes("REVOKE INSERT"), false);
    assert.equal(sql.includes("DROP POLICY"), false);
    assert.equal(sql.includes("UPDATE public.appointments"), false);
    assert.equal(sql.includes("ALTER TABLE public.visits"), false);
    assert.ok(visitAt > 0 && visitAt < appointmentAt);
    assert.equal(sql.includes("create_staff_visit"), false);
    assert.equal(sql.includes("ALTER TABLE public.appointments"), false);

    assert.match(contract, /guest_booking_contract_refused/);
    assert.match(contract, /REVOKE INSERT ON TABLE public\.visits FROM authenticated/);
    assert.match(
      contract,
      /REVOKE INSERT ON TABLE public\.appointments FROM authenticated/,
    );
    assert.match(contract, /DROP POLICY IF EXISTS visits_insert_own/);
    assert.match(contract, /DROP POLICY IF EXISTS appointments_insert_own/);
    assert.equal(contract.includes("GRANT INSERT"), false);
    assert.equal(contract.includes("DROP TABLE"), false);
    assert.equal(contract.includes("DROP FUNCTION"), false);
    assert.equal(
      contract.includes("CREATE OR REPLACE FUNCTION public.create_staff_visit"),
      false,
    );

    assert.match(rollback, /guest_booking_requests_not_empty/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public.create_guest_booking/);
    assert.match(rollback, /DROP TABLE IF EXISTS public.guest_booking_requests/);
    assert.ok(
      rollback.indexOf("guest_booking_requests_not_empty") <
        rollback.indexOf("DROP TABLE IF EXISTS public.guest_booking_requests"),
    );
    assert.equal(rollback.includes("GRANT INSERT"), false);
    assert.equal(rollback.includes("DROP TABLE public.appointments"), false);
    assert.equal(rollback.includes("DROP TABLE public.visits"), false);
    assert.equal(appRollback.includes("DROP TABLE"), false);
    assert.equal(appRollback.includes("GRANT INSERT"), false);
    assert.equal(appRollback.includes("DROP FUNCTION"), false);
    assert.match(appRollback, /guest_booking_app_rollback_blocked/);
    assert.equal(forwardFix.includes("GRANT INSERT"), false);
    assert.equal(forwardFix.includes("DROP TABLE"), false);
    assert.equal(forwardFix.includes("DROP FUNCTION"), false);
    assert.match(forwardFix, /guest_booking_contract_not_applied/);

    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const migrationNames = readdirSync(migrationsDir);
    assert.equal(migrationNames.includes("guest-booking-contract.sql"), false);
    assert.equal(
      existsSync(
        path.join(process.cwd(), "supabase/manual/rollback-guest-booking-idempotency.sql"),
      ),
      false,
    );
    for (const name of migrationNames) {
      const text = readFileSync(path.join(migrationsDir, name), "utf8");
      assert.equal(
        text.includes("REVOKE INSERT ON TABLE public.visits"),
        false,
        name,
      );
    }
    const config = readFileSync(path.join(process.cwd(), "supabase/config.toml"), "utf8");
    assert.match(config, /\[db\.migrations\]/);
    assert.match(config, /enabled = true/);
    assert.match(config, /schema_paths = \[\]/);
    assert.equal(config.includes("guest-booking-contract"), false);
    assert.equal(config.includes("manual/"), false);
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

  it("still lets the old app insert its own visit after expand", async () => {
    await db.exec(`GRANT authenticated TO CURRENT_USER`);
    await db.exec(`SET ROLE authenticated`);
    try {
      const inserted = await db.query<{ id: string }>(`
        INSERT INTO public.visits (
          customer_id, service_date, scheduled_start, appointment_time,
          address_street, address_city, address_state, address_zip
        ) VALUES (
          '${CUSTOMER}', '2026-10-21', 540, '9:00 AM',
          '1 Main', 'Lake Park', 'FL', '33403'
        )
        RETURNING id
      `);
      assert.equal(typeof inserted.rows[0]?.id, "string");
    } finally {
      await db.exec(`RESET ROLE`);
    }
  });
});

function pgBinary(name: string) {
  if (process.platform === "win32") {
    for (const version of ["18", "17", "16", "15", "14"]) {
      const candidate = path.join(process.env.ProgramFiles ?? "C:/Program Files", "PostgreSQL", version, "bin", `${name}.exe`);
      if (existsSync(candidate)) return candidate;
    }
  }
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
    socketDir = process.platform === "win32" ? "127.0.0.1" : mkdtempSync(path.join(tmpdir(), "k9-guest-sock-"));
    const init = spawnSync(
      pgBinary("initdb"),
      ["-D", dataDir, "-U", "postgres", "--auth=trust", "--no-sync", "--encoding=UTF8", "--locale=C"],
      { encoding: "utf8", windowsHide: true },
    );
    if (init.status !== 0) {
      throw new Error(init.stderr || init.stdout || "initdb failed");
    }
    server = spawn(
      pgBinary("postgres"),
      [
        "-D",
        dataDir,
        ...(process.platform === "win32" ? ["-c", "unix_socket_directories="] : ["-k", socketDir]),
        "-p",
        String(port),
        "-c",
        process.platform === "win32" ? "listen_addresses=127.0.0.1" : "listen_addresses=",
        "-c",
        "fsync=off",
      ],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
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
    await left.query(sqlFile(EXPAND));
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
        { encoding: "utf8", windowsHide: true },
      );
    }
    if (server && server.exitCode == null) server.kill("SIGKILL");
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    if (socketDir && process.platform !== "win32") rmSync(socketDir, { recursive: true, force: true });
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

  async function freshDatabase(name: string) {
    await left!.query(`DROP DATABASE IF EXISTS ${name}`);
    await left!.query(`CREATE DATABASE ${name}`);
    const client = new Client({
      host: socketDir,
      port,
      user: "postgres",
      database: name,
    });
    await client.connect();
    await client.query(fixtureSql());
    await client.query(`GRANT anon, authenticated, service_role TO CURRENT_USER`);
    return client;
  }

  function staffVisitSql() {
    const source = sqlFile("supabase/migrations/20261007180000_visit_sequence.sql");
    const start = source.indexOf("CREATE OR REPLACE FUNCTION public.create_staff_visit(");
    const end = source.indexOf("-- Service fields, travel mirror");
    if (start < 0 || end < start) {
      throw new Error("create_staff_visit block was not found");
    }
    return `
      CREATE OR REPLACE FUNCTION public.visit_arrival_label(p_minutes integer)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      AS $fn$
        SELECT CASE
          WHEN p_minutes IS NULL THEN NULL::text
          ELSE
            (CASE
              WHEN (p_minutes / 60) % 12 = 0 THEN 12
              ELSE (p_minutes / 60) % 12
            END)::text
            || ':'
            || pg_catalog.lpad((pg_catalog.mod(p_minutes, 60))::text, 2, '0')
            || CASE WHEN (p_minutes / 60) >= 12 THEN ' PM' ELSE ' AM' END
        END;
      $fn$;
      ${source.slice(start, end)}
    `;
  }

  async function asRole<T>(
    client: Client,
    role: "authenticated" | "service_role" | "anon",
    run: () => Promise<T>,
  ) {
    await client.query(`SET ROLE ${role}`);
    try {
      return await run();
    } finally {
      await client.query("RESET ROLE");
    }
  }

  async function oldAppInsert(client: Client, start: number) {
    return asRole(client, "authenticated", async () => {
      const visit = await client.query<{ id: string }>(
        `INSERT INTO public.visits (
           customer_id, service_date, scheduled_start, appointment_time,
           address_street, address_city, address_state, address_zip
         ) VALUES ($1, '2026-10-22', $2, '9:00 AM', '1 Main', 'Lake Park', 'FL', '33403')
         RETURNING id`,
        [CUSTOMER, start],
      );
      const visitId = visit.rows[0]?.id;
      await client.query(
        `INSERT INTO public.appointments (
           customer_id, visit_id, visit_sequence, pet_id, service_id, service_name,
           address_street, address_city, address_state, address_zip,
           appointment_date, appointment_time, scheduled_start, staff_created
         ) VALUES (
           $1, $2, 1, $3, 'signature-bath-care', 'The Signature Bath',
           '1 Main', 'Lake Park', 'FL', '33403',
           '2026-10-22', '9:00 AM', $4, false
         )`,
        [CUSTOMER, visitId, PET, start],
      );
      return visitId;
    });
  }

  it("accepts the old app and the new app together after expand", async () => {
    const client = await freshDatabase("k9_guest_compat");
    try {
      await client.query(sqlFile(EXPAND));
      await client.query(staffVisitSql());
      const oldVisit = await oldAppInsert(client, 480);
      assert.equal(typeof oldVisit, "string");

      await asRole(client, "service_role", async () => {
        const saved = await call(client, "hash-new-app", KEY, 510);
        assert.equal(bookingResult(saved.rows[0]?.result).created, true);
        const staffVisit = await client.query<{ id: string }>(
          `SELECT public.create_staff_visit($1::jsonb, $2::jsonb) AS id`,
          [
            JSON.stringify({
              customer_id: CUSTOMER,
              service_date: "2026-10-22",
              scheduled_start: 630,
              time_preference: "morning",
              timezone: "America/New_York",
              status: "confirmed",
              address_street: "1 Main",
              address_city: "Lake Park",
              address_state: "FL",
              address_zip: "33403",
              travel_distance_miles: 4,
              travel_fee: 0,
            }),
            JSON.stringify([
              {
                customer_id: CUSTOMER,
                pet_id: PET,
                service_id: "signature-bath-care",
                service_name: "The Signature Bath",
                visit_sequence: 1,
                address_street: "1 Main",
                address_city: "Lake Park",
                address_state: "FL",
                address_zip: "33403",
                appointment_date: "2026-10-22",
                appointment_time: "10:30 AM",
                scheduled_start: 630,
                status: "confirmed",
                staff_created: true,
              },
            ]),
          ],
        );
        assert.equal(typeof staffVisit.rows[0]?.id, "string");
      });

      await assert.rejects(
        asRole(client, "authenticated", () =>
          call(client, "hash-browser", OTHER_KEY, 660),
        ),
        (error: unknown) =>
          error instanceof Error && /permission denied/i.test(error.message),
      );
      await assert.rejects(
        asRole(client, "anon", () => call(client, "hash-anon", OTHER_KEY, 690)),
        (error: unknown) =>
          error instanceof Error && /permission denied/i.test(error.message),
      );

      await client.query(sqlFile(APP_ROLLBACK));
      const kept = await client.query<{ claims: string; visits: string }>(
        `SELECT
           (SELECT count(*)::text FROM public.guest_booking_requests) AS claims,
           (SELECT count(*)::text FROM public.visits) AS visits`,
      );
      assert.equal(kept.rows[0]?.claims, "1");
      assert.equal(kept.rows[0]?.visits, "3");
    } finally {
      await client.end();
    }
  });

  it("refuses the contract until the operator confirms, then blocks the old insert", async () => {
    const client = await freshDatabase("k9_guest_contract");
    try {
      await client.query(sqlFile(EXPAND));
      await client.query(staffVisitSql());
      await client.query(sqlFile(EXPAND));
      const before = await oldAppInsert(client, 700);
      assert.equal(typeof before, "string");

      await assert.rejects(client.query(sqlFile(CONTRACT)));
      await client.query("ROLLBACK");
      const stillOpen = await oldAppInsert(client, 720);
      assert.equal(typeof stillOpen, "string");

      await client.query(
        `SELECT set_config('k9.guest_booking_contract', 'apply', false)`,
      );
      await client.query(sqlFile(CONTRACT));

      await assert.rejects(oldAppInsert(client, 740));
      const privileges = await client.query<{
        visit_insert: boolean;
        appointment_insert: boolean;
        service_execute: boolean;
        customer_execute: boolean;
      }>(
        `SELECT
           has_table_privilege('authenticated', 'public.visits', 'INSERT') AS visit_insert,
           has_table_privilege('authenticated', 'public.appointments', 'INSERT') AS appointment_insert,
           has_function_privilege(
             'service_role',
             'public.create_guest_booking(uuid,text,jsonb,jsonb)',
             'EXECUTE'
           ) AS service_execute,
           has_function_privilege(
             'authenticated',
             'public.create_guest_booking(uuid,text,jsonb,jsonb)',
             'EXECUTE'
           ) AS customer_execute`,
      );
      assert.equal(privileges.rows[0]?.visit_insert, false);
      assert.equal(privileges.rows[0]?.appointment_insert, false);
      assert.equal(privileges.rows[0]?.service_execute, true);
      assert.equal(privileges.rows[0]?.customer_execute, false);

      await asRole(client, "service_role", async () => {
        const saved = await call(client, "hash-after-contract", KEY, 760);
        assert.equal(bookingResult(saved.rows[0]?.result).created, true);
        const staffVisit = await client.query<{ id: string }>(
          `SELECT public.create_staff_visit($1::jsonb, $2::jsonb) AS id`,
          [
            JSON.stringify({
              customer_id: CUSTOMER,
              service_date: "2026-10-23",
              scheduled_start: 780,
              timezone: "America/New_York",
              status: "confirmed",
              address_street: "1 Main",
              address_city: "Lake Park",
              address_state: "FL",
              address_zip: "33403",
            }),
            JSON.stringify([
              {
                customer_id: CUSTOMER,
                pet_id: PET,
                service_id: "signature-bath-care",
                service_name: "The Signature Bath",
                visit_sequence: 1,
                address_street: "1 Main",
                address_city: "Lake Park",
                address_state: "FL",
                address_zip: "33403",
                appointment_date: "2026-10-23",
                scheduled_start: 780,
                status: "confirmed",
                staff_created: true,
              },
            ]),
          ],
        );
        assert.equal(typeof staffVisit.rows[0]?.id, "string");
      });

      const beforeRepair = await client.query<{ claims: string }>(
        `SELECT count(*)::text AS claims FROM public.guest_booking_requests`,
      );
      await client.query(sqlFile(EXPAND));
      await client.query(sqlFile(FORWARD_FIX));
      const afterRepair = await client.query<{
        claims: string;
        visit_insert: boolean;
      }>(
        `SELECT
           (SELECT count(*)::text FROM public.guest_booking_requests) AS claims,
           has_table_privilege('authenticated', 'public.visits', 'INSERT') AS visit_insert`,
      );
      assert.equal(afterRepair.rows[0]?.claims, beforeRepair.rows[0]?.claims);
      assert.equal(afterRepair.rows[0]?.visit_insert, false);
      await assert.rejects(client.query(sqlFile(APP_ROLLBACK)));
    } finally {
      await client.end();
    }
  });

  it("drops an empty expand and keeps claims that already point at a booking", async () => {
    const empty = await freshDatabase("k9_guest_expand_empty");
    try {
      await empty.query(sqlFile(EXPAND));
      await empty.query(sqlFile(ROLLBACK_EXPAND));
      const gone = await empty.query<{ fn: string | null; rel: string | null }>(
        `SELECT
           to_regprocedure('public.create_guest_booking(uuid,text,jsonb,jsonb)')::text AS fn,
           to_regclass('public.guest_booking_requests')::text AS rel`,
      );
      assert.equal(gone.rows[0]?.fn, null);
      assert.equal(gone.rows[0]?.rel, null);
      const stillOpen = await oldAppInsert(empty, 800);
      assert.equal(typeof stillOpen, "string");
    } finally {
      await empty.end();
    }

    const used = await freshDatabase("k9_guest_expand_used");
    try {
      await used.query(sqlFile(EXPAND));
      await used.query(`GRANT service_role TO CURRENT_USER`);
      await asRole(used, "service_role", () =>
        call(used, "hash-keep", KEY, 820),
      );
      await assert.rejects(used.query(sqlFile(ROLLBACK_EXPAND)));
      await used.query("ROLLBACK");
      const kept = await used.query<{ claims: string; visits: string; appointments: string }>(
        `SELECT
           (SELECT count(*)::text FROM public.guest_booking_requests) AS claims,
           (SELECT count(*)::text FROM public.visits) AS visits,
           (SELECT count(*)::text FROM public.appointments) AS appointments`,
      );
      assert.equal(kept.rows[0]?.claims, "1");
      assert.equal(kept.rows[0]?.visits, "1");
      assert.equal(kept.rows[0]?.appointments, "1");
      const fn = await used.query<{ fn: string | null }>(
        `SELECT to_regprocedure('public.create_guest_booking(uuid,text,jsonb,jsonb)')::text AS fn`,
      );
      assert.equal(fn.rows[0]?.fn !== null, true);
    } finally {
      await used.end();
    }
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const CUSTOMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VISIT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DAISY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MILO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const COCO = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PET_A = "11111111-1111-4111-8111-111111111111";
const PET_B = "22222222-2222-4222-8222-222222222222";
const PET_C = "33333333-3333-4333-8333-333333333333";

let db: PGlite;

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS private;
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
      travel_fee numeric(8, 2) NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT visits_scheduled_start_range CHECK (
        scheduled_start IS NULL OR (scheduled_start >= 0 AND scheduled_start < 1440)
      ),
      CONSTRAINT visits_time_preference_check CHECK (
        time_preference IS NULL OR time_preference IN ('morning', 'afternoon')
      )
    );

    CREATE TABLE public.appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL,
      visit_id uuid,
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
      service_price numeric(8, 2),
      estimated_duration_minutes integer,
      appointment_date date NOT NULL,
      appointment_time text,
      scheduled_start integer,
      time_preference text,
      address_lat double precision,
      address_lon double precision,
      timezone text NOT NULL DEFAULT 'America/New_York',
      estimated_total numeric(8, 2),
      new_client_deposit numeric(8, 2),
      payment_method_id uuid,
      vaccination_status_at_booking text,
      status public.appointment_status NOT NULL,
      confirmed_at timestamptz,
      staff_created boolean NOT NULL DEFAULT false,
      customer_confirm_token_hash text,
      customer_confirm_expires_at timestamptz,
      service_ended_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT appointments_scheduled_start_range CHECK (
        scheduled_start IS NULL OR (scheduled_start >= 0 AND scheduled_start < 1440)
      ),
      CONSTRAINT appointments_visit_id_fkey
        FOREIGN KEY (visit_id) REFERENCES public.visits (id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX appointments_unique_scheduled_start
      ON public.appointments (appointment_date, scheduled_start)
      WHERE status IS DISTINCT FROM 'cancelled' AND scheduled_start IS NOT NULL;
  `);

  const migration = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20261007140000_visit_integrity.sql",
    ),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE IF NOT EXISTS public.pets (
      id uuid PRIMARY KEY,
      customer_id uuid NOT NULL,
      archived_at timestamptz
    );
  `);
  const sequence = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20261007180000_visit_sequence.sql",
    ),
    "utf8",
  );
  await db.exec(sequence);
  await db.exec(`
    CREATE TRIGGER appointments_sync_visit
      AFTER INSERT OR UPDATE OF status, service_ended_at, scheduled_start,
        appointment_time, time_preference, appointment_date, visit_id
      ON public.appointments
      FOR EACH ROW
      EXECUTE FUNCTION private.sync_visit_from_appointments();
  `);
  await db.exec(
    "SELECT set_config('request.jwt.claim.role', 'service_role', false)",
  );
});

describe("visit integrity in postgres", () => {
  it("uses the same arrival label as the application", async () => {
    const { visitArrivalFields } = await import("@/lib/visits/visit");
    const minutes = [0, 9 * 60 + 5, 12 * 60, 15 * 60, 15 * 60 + 30, 23 * 60 + 59];
    const labels = await db.query<{ label: string; minute: number }>(
      `SELECT minute, public.visit_arrival_label(minute) AS label
       FROM unnest($1::integer[]) AS minute`,
      [minutes],
    );
    assert.deepEqual(
      labels.rows.map((row) => [row.minute, row.label]),
      minutes.map((minute) => [minute, visitArrivalFields(minute).appointmentTime]),
    );
  });

  it("rejects deleting a visit that still has appointments", async () => {
    await insertVisit({
      id: VISIT,
      start: 10 * 60,
      date: "2026-11-23",
    });
    await insertAppointment({
      id: DAISY,
      visitId: VISIT,
      petId: PET_A,
      start: 10 * 60,
      date: "2026-11-23",
      name: "Daisy",
    });

    const deleted = await rejectSql(`DELETE FROM public.visits WHERE id = '${VISIT}'`);
    assert.match(deleted, /violates foreign key constraint|appointments_visit_id_fkey/i);

    const remaining = await db.query<{ id: string }>(
      "SELECT id::text AS id FROM public.appointments WHERE visit_id = $1",
      [VISIT],
    );
    assert.deepEqual(
      remaining.rows.map((row) => row.id),
      [DAISY],
    );
  });

  it("refuses a visit whose display time is not the arrival label", async () => {
    const rejected = await rejectSql(`
      INSERT INTO public.visits (
        id, customer_id, service_date, scheduled_start, appointment_time,
        address_street, address_city, address_state, address_zip, status
      ) VALUES (
        '99999999-9999-4999-8999-999999999999',
        '${CUSTOMER}',
        '2026-11-24',
        ${15 * 60 + 30},
        '3:00 PM',
        '1 Main', 'Jupiter', 'FL', '33458',
        'confirmed'
      )
    `);
    assert.match(rejected, /visits_appointment_time_matches_start/);
  });

  it("keeps the visit label when a child stores a route window", async () => {
    const visitId = "abababab-abab-4aba-8aba-abababababab";
    const appointmentId = "cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd";
    await insertVisit({ id: visitId, start: 15 * 60 + 30, date: "2026-11-25" });
    await insertAppointment({
      id: appointmentId,
      visitId,
      petId: PET_A,
      start: 15 * 60 + 30,
      date: "2026-11-25",
      name: "Daisy",
      appointmentTime: "3:30–4:45 PM",
    });
    const visit = await db.query<{ appointment_time: string; scheduled_start: number }>(
      "SELECT appointment_time, scheduled_start FROM public.visits WHERE id = $1",
      [visitId],
    );
    assert.equal(visit.rows[0]?.scheduled_start, 15 * 60 + 30);
    assert.equal(visit.rows[0]?.appointment_time, "3:30 PM");
  });

  it("rolls back the whole staff visit when a later dog cannot be inserted", async () => {
    const before = await countRows();
    const rejected = await rejectSql(`
      SELECT public.create_staff_visit(
        ${visitJson(15 * 60 + 30, "2026-11-26")},
        jsonb_build_array(
          ${appointmentJson({ petId: PET_A, start: 15 * 60 + 30, date: "2026-11-26", name: "Daisy" })},
          ${appointmentJson({ petId: PET_B, start: 9999, date: "2026-11-26", name: "Milo" })}
        )
      )
    `);
    assert.match(rejected, /appointments_scheduled_start_range|check constraint/i);
    assert.deepEqual(await countRows(), before);
  });

  it("commits every dog of a staff visit together", async () => {
    const created = await db.query<{ id: string }>(`
      SELECT public.create_staff_visit(
        ${visitJson(15 * 60 + 30, "2026-11-27")},
        jsonb_build_array(
          ${appointmentJson({ petId: PET_A, start: 15 * 60 + 30, date: "2026-11-27", name: "Daisy", travelFee: 12.5 })},
          ${appointmentJson({ petId: PET_B, start: 16 * 60 + 45, date: "2026-11-27", name: "Milo", travelFee: 0 })},
          ${appointmentJson({ petId: PET_C, start: 18 * 60 + 25, date: "2026-11-27", name: "Coco", travelFee: 0 })}
        )
      )::text AS id
    `);
    const visitId = created.rows[0]?.id;
    assert.ok(visitId);
    const visit = await db.query<{
      scheduled_start: number;
      appointment_time: string;
      travel_fee: string;
    }>(
      "SELECT scheduled_start, appointment_time, travel_fee::text FROM public.visits WHERE id = $1",
      [visitId],
    );
    assert.equal(visit.rows[0]?.scheduled_start, 15 * 60 + 30);
    assert.equal(visit.rows[0]?.appointment_time, "3:30 PM");
    assert.equal(visit.rows[0]?.travel_fee, "12.50");
    const dogs = await db.query<{ service_name: string; scheduled_start: number; travel_fee: string }>(
      `SELECT service_name, scheduled_start, travel_fee::text
       FROM public.appointments
       WHERE visit_id = $1
       ORDER BY scheduled_start`,
      [visitId],
    );
    assert.deepEqual(
      dogs.rows.map((row) => [row.service_name, row.scheduled_start, row.travel_fee]),
      [
        ["Daisy", 15 * 60 + 30, "12.50"],
        ["Milo", 16 * 60 + 45, "0.00"],
        ["Coco", 18 * 60 + 25, "0.00"],
      ],
    );
  });

  it("rolls a multi-pet reschedule back to the previous chain", async () => {
    const visitId = "12121212-1212-4121-8121-121212121212";
    const daisy = "13131313-1313-4131-8131-131313131313";
    const milo = "14141414-1414-4141-8141-141414141414";
    const coco = "15151515-1515-4151-8151-151515151515";
    await insertVisit({ id: visitId, start: 10 * 60, date: "2026-11-28" });
    await insertAppointment({
      id: daisy, visitId, petId: PET_A, start: 10 * 60, date: "2026-11-28", name: "Daisy",
    });
    await insertAppointment({
      id: milo, visitId, petId: PET_B, start: 11 * 60 + 15, date: "2026-11-28", name: "Milo",
    });
    await insertAppointment({
      id: coco, visitId, petId: PET_C, start: 12 * 60 + 55, date: "2026-11-28", name: "Coco",
    });

    const rejected = await rejectSql(`
      SELECT public.replace_visit_schedule(
        '${visitId}',
        '2026-11-29',
        ${15 * 60 + 30},
        'afternoon',
        jsonb_build_array(
          jsonb_build_object('id', '${daisy}', 'scheduled_start', ${15 * 60 + 30}, 'estimated_duration_minutes', 75, 'appointment_time', '3:30 PM', 'time_preference', 'afternoon'),
          jsonb_build_object('id', '${milo}', 'scheduled_start', ${16 * 60 + 45}, 'estimated_duration_minutes', 90, 'appointment_time', '3:30 PM', 'time_preference', 'afternoon'),
          jsonb_build_object('id', '${coco}', 'scheduled_start', 9999, 'estimated_duration_minutes', 80, 'appointment_time', '3:30 PM', 'time_preference', 'afternoon')
        )
      )
    `);
    assert.match(rejected, /appointments_scheduled_start_range|check constraint/i);

    const dogs = await db.query<{ id: string; scheduled_start: number; appointment_date: string }>(
      `SELECT id::text, scheduled_start, appointment_date::text
       FROM public.appointments
       WHERE visit_id = $1
       ORDER BY scheduled_start`,
      [visitId],
    );
    assert.deepEqual(
      dogs.rows.map((row) => [row.id, row.scheduled_start, row.appointment_date]),
      [
        [daisy, 10 * 60, "2026-11-28"],
        [milo, 11 * 60 + 15, "2026-11-28"],
        [coco, 12 * 60 + 55, "2026-11-28"],
      ],
    );
    const visit = await db.query<{ scheduled_start: number; appointment_time: string; service_date: string }>(
      "SELECT scheduled_start, appointment_time, service_date::text FROM public.visits WHERE id = $1",
      [visitId],
    );
    assert.equal(visit.rows[0]?.scheduled_start, 10 * 60);
    assert.equal(visit.rows[0]?.appointment_time, "10:00 AM");
    assert.equal(visit.rows[0]?.service_date, "2026-11-28");

    await db.exec(`
      SELECT public.replace_visit_schedule(
        '${visitId}',
        '2026-11-29',
        ${15 * 60 + 30},
        'afternoon',
        jsonb_build_array(
          jsonb_build_object('id', '${daisy}', 'scheduled_start', ${15 * 60 + 30}, 'estimated_duration_minutes', 75, 'appointment_time', '3:30 PM', 'time_preference', 'afternoon'),
          jsonb_build_object('id', '${milo}', 'scheduled_start', ${16 * 60 + 45}, 'estimated_duration_minutes', 90, 'appointment_time', '3:30 PM', 'time_preference', 'afternoon'),
          jsonb_build_object('id', '${coco}', 'scheduled_start', ${18 * 60 + 25}, 'estimated_duration_minutes', 80, 'appointment_time', '3:30 PM', 'time_preference', 'afternoon')
        )
      )
    `);
    const moved = await db.query<{ service_name: string; scheduled_start: number; appointment_date: string }>(
      `SELECT service_name, scheduled_start, appointment_date::text
       FROM public.appointments WHERE visit_id = $1 ORDER BY scheduled_start`,
      [visitId],
    );
    assert.deepEqual(
      moved.rows.map((row) => [row.service_name, row.scheduled_start, row.appointment_date]),
      [
        ["Daisy", 15 * 60 + 30, "2026-11-29"],
        ["Milo", 16 * 60 + 45, "2026-11-29"],
        ["Coco", 18 * 60 + 25, "2026-11-29"],
      ],
    );
    const movedVisit = await db.query<{ scheduled_start: number; appointment_time: string }>(
      "SELECT scheduled_start, appointment_time FROM public.visits WHERE id = $1",
      [visitId],
    );
    assert.equal(movedVisit.rows[0]?.scheduled_start, 15 * 60 + 30);
    assert.equal(movedVisit.rows[0]?.appointment_time, "3:30 PM");
  });
});

async function rejectSql(sql: string) {
  try {
    await db.exec(sql);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  assert.fail("expected the database to reject the statement");
}

async function countRows() {
  const visits = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.visits",
  );
  const appointments = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.appointments",
  );
  return {
    visits: Number(visits.rows[0]?.count ?? 0),
    appointments: Number(appointments.rows[0]?.count ?? 0),
  };
}

async function insertVisit(input: { id: string; start: number; date: string }) {
  await db.query(
    `INSERT INTO public.visits (
      id, customer_id, service_date, scheduled_start, appointment_time,
      address_street, address_city, address_state, address_zip, status
    ) VALUES ($1, $2, $3, $4, public.visit_arrival_label($4), '1 Main', 'Jupiter', 'FL', '33458', 'confirmed')`,
    [input.id, CUSTOMER, input.date, input.start],
  );
}

async function insertAppointment(input: {
  id: string;
  visitId: string;
  petId: string;
  start: number;
  date: string;
  name: string;
  appointmentTime?: string;
}) {
  await db.query(
    `INSERT INTO public.appointments (
      id, customer_id, visit_id, pet_id, service_id, service_name,
      address_street, address_city, address_state, address_zip,
      appointment_date, appointment_time, scheduled_start, status
    ) VALUES (
      $1, $2, $3, $4, 'bath', $5,
      '1 Main', 'Jupiter', 'FL', '33458',
      $6, $7, $8, 'confirmed'
    )`,
    [
      input.id,
      CUSTOMER,
      input.visitId,
      input.petId,
      input.name,
      input.date,
      input.appointmentTime ?? "10:00 AM",
      input.start,
    ],
  );
}

function visitJson(start: number, date: string) {
  return `jsonb_build_object(
    'customer_id', '${CUSTOMER}',
    'service_date', '${date}',
    'scheduled_start', ${start},
    'time_preference', 'afternoon',
    'timezone', 'America/New_York',
    'status', 'pending_confirmation',
    'address_street', '1 Main',
    'address_city', 'Jupiter',
    'address_state', 'FL',
    'address_zip', '33458',
    'address_lat', 26.93,
    'address_lon', -80.09,
    'travel_distance_miles', 4.2,
    'travel_fee', 12.5
  )`;
}

function appointmentJson(input: {
  petId: string;
  start: number;
  date: string;
  name: string;
  travelFee?: number;
}) {
  return `jsonb_build_object(
    'customer_id', '${CUSTOMER}',
    'pet_id', '${input.petId}',
    'service_id', 'bath',
    'service_name', '${input.name}',
    'add_on_ids', '[]'::jsonb,
    'add_on_options', '{}'::jsonb,
    'address_street', '1 Main',
    'address_city', 'Jupiter',
    'address_state', 'FL',
    'address_zip', '33458',
    'travel_distance_miles', 4.2,
    'travel_fee', ${input.travelFee ?? 0},
    'service_price', 80,
    'estimated_duration_minutes', 75,
    'appointment_date', '${input.date}',
    'appointment_time', '3:30–4:45 PM',
    'scheduled_start', ${input.start},
    'time_preference', 'afternoon',
    'address_lat', 26.93,
    'address_lon', -80.09,
    'timezone', 'America/New_York',
    'estimated_total', 80,
    'new_client_deposit', 0,
    'vaccination_status_at_booking', 'missing',
    'status', 'pending_confirmation',
    'staff_created', true,
    'customer_confirm_token_hash', 'token-1',
    'customer_confirm_expires_at', '2026-12-01T00:00:00Z'
  )`;
}

const SEQ_VISIT = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const SEQ_A = "10000000-0000-4000-8000-000000000001";
const SEQ_B = "20000000-0000-4000-8000-000000000002";
const SEQ_C = "30000000-0000-4000-8000-000000000003";
const SEQ_PET = "40000000-0000-4000-8000-000000000004";

describe("visit sequence in postgres", () => {
  it("backfills equal or null starts by appointment id", async () => {
    await insertVisit({ id: SEQ_VISIT, start: 10 * 60, date: "2026-12-03" });
    await db.exec(
      "ALTER TABLE public.appointments DISABLE TRIGGER appointments_assign_visit_sequence",
    );
    await db.exec(`
      INSERT INTO public.appointments (
        id, customer_id, visit_id, pet_id, service_id, service_name,
        address_street, address_city, address_state, address_zip,
        appointment_date, scheduled_start, status
      ) VALUES
        ('${SEQ_B}', '${CUSTOMER}', '${SEQ_VISIT}', '${SEQ_PET}', 'bath', 'Later',
         '1 Main', 'Jupiter', 'FL', '33458', '2026-12-03', ${10 * 60}, 'confirmed'),
        ('${SEQ_A}', '${CUSTOMER}', '${SEQ_VISIT}', '${SEQ_PET}', 'bath', 'Earlier id',
         '1 Main', 'Jupiter', 'FL', '33458', '2026-12-03', ${10 * 60}, 'cancelled'),
        ('${SEQ_C}', '${CUSTOMER}', '${SEQ_VISIT}', '${SEQ_PET}', 'bath', 'No start',
         '1 Main', 'Jupiter', 'FL', '33458', '2026-12-03', NULL, 'confirmed')
    `);
    await db.exec(`
      WITH ranked AS (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY visit_id
            ORDER BY scheduled_start ASC NULLS LAST, id ASC
          ) AS seq
        FROM public.appointments
        WHERE visit_id = '${SEQ_VISIT}'
      )
      UPDATE public.appointments AS appointment
      SET visit_sequence = ranked.seq
      FROM ranked
      WHERE appointment.id = ranked.id
        AND appointment.visit_sequence IS NULL
    `);
    await db.exec(
      "ALTER TABLE public.appointments ENABLE TRIGGER appointments_assign_visit_sequence",
    );
    const rows = await db.query<{ id: string; visit_sequence: number }>(
      `SELECT id::text, visit_sequence
       FROM public.appointments
       WHERE visit_id = $1
       ORDER BY visit_sequence`,
      [SEQ_VISIT],
    );
    assert.deepEqual(
      rows.rows.map((row) => [row.id, row.visit_sequence]),
      [
        [SEQ_A, 1],
        [SEQ_B, 2],
        [SEQ_C, 3],
      ],
    );
  });

  it("writes submission order even when clock times run backward", async () => {
    const created = await db.query<{ id: string }>(
      `SELECT public.create_staff_visit(
        ${visitJson(15 * 60 + 30, "2026-12-04")},
        jsonb_build_array(
          ${appointmentJson({ petId: PET_A, start: 18 * 60, date: "2026-12-04", name: "Daisy", travelFee: 12.5 })},
          ${appointmentJson({ petId: PET_B, start: 11 * 60, date: "2026-12-04", name: "Milo" })},
          ${appointmentJson({ petId: PET_C, start: 9 * 60, date: "2026-12-04", name: "Coco" })}
        )
      )::text AS id`,
    );
    const visitId = created.rows[0]?.id;
    const dogs = await db.query<{ service_name: string; visit_sequence: number }>(
      `SELECT service_name, visit_sequence
       FROM public.appointments
       WHERE visit_id = $1
       ORDER BY visit_sequence`,
      [visitId],
    );
    assert.deepEqual(
      dogs.rows.map((row) => [row.service_name, row.visit_sequence]),
      [
        ["Daisy", 1],
        ["Milo", 2],
        ["Coco", 3],
      ],
    );
  });

  it("rolls back a service change that does not fit the visit", async () => {
    const visitId = "99999999-9999-4999-8999-999999999999";
    const appointmentId = "88888888-8888-4888-8888-888888888888";
    await insertVisit({ id: visitId, start: 10 * 60, date: "2026-12-05" });
    await insertAppointment({
      id: appointmentId,
      visitId,
      petId: PET_A,
      start: 10 * 60,
      date: "2026-12-05",
      name: "Bath",
    });
    const before = await db.query<{ service_name: string; scheduled_start: number }>(
      "SELECT service_name, scheduled_start FROM public.appointments WHERE id = $1",
      [appointmentId],
    );
    const rejected = await rejectSql(`
      SELECT public.apply_visit_service_change(
        '${appointmentId}',
        '${visitId}',
        jsonb_build_object(
          'service_id', 'strip',
          'service_name', 'Hand Strip',
          'add_on_ids', '[]'::jsonb,
          'add_on_options', '{}'::jsonb,
          'travel_fee', 12.5,
          'estimated_total', 90,
          'estimated_duration_minutes', 80
        ),
        '2026-12-05'::date,
        9999,
        'morning',
        jsonb_build_array(jsonb_build_object(
          'id', '${appointmentId}',
          'scheduled_start', 9999,
          'estimated_duration_minutes', 80,
          'appointment_time', '10:00 AM',
          'time_preference', 'morning'
        ))
      )
    `);
    assert.match(rejected, /appointments_scheduled_start_range|check constraint/i);
    const after = await db.query<{
      service_name: string;
      scheduled_start: number;
      estimated_duration_minutes: number | null;
    }>(
      `SELECT service_name, scheduled_start, estimated_duration_minutes
       FROM public.appointments WHERE id = $1`,
      [appointmentId],
    );
    assert.equal(after.rows[0]?.service_name, before.rows[0]?.service_name);
    assert.equal(after.rows[0]?.scheduled_start, before.rows[0]?.scheduled_start);
    assert.equal(after.rows[0]?.estimated_duration_minutes, null);
    const visit = await db.query<{ travel_fee: string }>(
      "SELECT travel_fee::text FROM public.visits WHERE id = $1",
      [visitId],
    );
    assert.equal(visit.rows[0]?.travel_fee, "0.00");
  });
});
